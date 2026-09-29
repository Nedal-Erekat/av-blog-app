// Runs the "Ask the blog" evaluation set against the REAL model and prints a scorecard.
//   npm run ai:eval -w apps/api
// Needs GEMINI_API_KEY, the seed posts (npm run prisma:seed) and the search index
// (npm run ai:reindex). Exits with code 1 if any metric is below its threshold, so it can gate
// a deploy or a prompt change.
import 'dotenv/config';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createAiProvider } from '../ai';
import {
  EvalDatasetSchema,
  failedThresholds,
  scoreCase,
  summarize,
  THRESHOLDS,
  type CaseScore,
} from '../evals/scoring';
import { prisma } from '../lib/prisma';
import { createAskService } from '../services/ask.service';
import { createSearchService } from '../services/search.service';

const EVALS_DIR = path.resolve(__dirname, '../../evals');
// Pause between cases to stay under the free tier's requests-per-minute limit.
const DELAY_MS = Number(process.env.EVAL_DELAY_MS ?? 4000);

async function main() {
  if (!createAiProvider()) throw new Error('GEMINI_API_KEY is not set: evals need the real model');

  const dataset = EvalDatasetSchema.parse(
    JSON.parse(readFileSync(path.join(EVALS_DIR, 'ask-blog.cases.json'), 'utf8')),
  );
  if ((await prisma.postChunk.count()) === 0) {
    throw new Error('The search index is empty: run `npm run ai:reindex -w apps/api` first');
  }

  const askService = createAskService();
  const searchService = createSearchService();
  const author = await prisma.user.findFirstOrThrow();

  // Plant the poisoned posts (prompt injection canaries), and always remove them afterwards.
  const poisoned = [];
  for (const fixture of dataset.fixtures.poisonedPosts) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.post.deleteMany({ where: { slug: fixture.slug } });
    // eslint-disable-next-line no-await-in-loop
    const post = await prisma.post.create({
      data: { ...fixture, excerpt: fixture.title, authorId: author.id },
    });
    // eslint-disable-next-line no-await-in-loop
    await searchService.indexPost(post);
    poisoned.push(post.id);
  }

  const scores: (CaseScore & { question: string; answer: string })[] = [];
  try {
    for (const evalCase of dataset.cases) {
      // eslint-disable-next-line no-await-in-loop
      const { response, retrieved } = await askService.askBlogDetailed(evalCase.question);
      const score = scoreCase(
        evalCase,
        response,
        retrieved.map((chunk) => chunk.slug),
      );
      scores.push({ ...score, question: evalCase.question, answer: response.answer });
      console.info(`${score.passed ? 'PASS' : 'FAIL'}  ${evalCase.id}`);
      if (!score.passed) console.info(`      answer: ${response.answer}`);
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  } finally {
    await prisma.post.deleteMany({ where: { id: { in: poisoned } } });
  }

  const summary = summarize(scores);
  const pct = (value: number | null) => (value === null ? 'n/a' : `${Math.round(value * 100)}%`);
  console.info(`\n${summary.passed}/${summary.cases} cases passed`);
  for (const metric of Object.keys(THRESHOLDS) as (keyof typeof THRESHOLDS)[]) {
    console.info(
      `  ${metric.padEnd(20)} ${pct(summary[metric]).padStart(5)}  (min ${pct(THRESHOLDS[metric])})`,
    );
  }

  // Keep every run so you can compare before/after a prompt, model or chunking change.
  const resultsDir = path.join(EVALS_DIR, 'results');
  mkdirSync(resultsDir, { recursive: true });
  const file = path.join(resultsDir, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, JSON.stringify({ summary, scores }, null, 2));
  console.info(`\nFull results: ${path.relative(process.cwd(), file)}`);

  const failed = failedThresholds(summary);
  if (failed.length > 0) {
    console.error(`Below threshold: ${failed.join(', ')}`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
