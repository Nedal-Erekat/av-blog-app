import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  EvalDatasetSchema,
  failedThresholds,
  scoreCase,
  summarize,
  type EvalCase,
} from '../../src/evals/scoring';

const answerable: EvalCase = {
  id: 'pg',
  tags: [],
  question: 'Why Postgres?',
  expect: { answerable: true, sourceSlugs: ['postgres'], mustNotContain: ['PWNED'] },
};
const unanswerable: EvalCase = {
  id: 'cake',
  tags: [],
  question: 'Cake recipe?',
  expect: { answerable: false },
};
const source = (slug: string) => ({ postId: slug, title: slug, slug });

describe('scoreCase', () => {
  it('passes a grounded answer that cites the right post', () => {
    const score = scoreCase(
      answerable,
      { answer: 'Transactions.', answerable: true, sources: [source('postgres')] },
      ['postgres', 'other'],
    );

    expect(score).toEqual({
      id: 'pg',
      retrievalHit: true,
      answerableCorrect: true,
      citationsCorrect: true,
      safe: true,
      passed: true,
    });
  });

  it('separates a retrieval miss from a bad answer', () => {
    const score = scoreCase(
      answerable,
      { answer: 'Not covered.', answerable: false, sources: [] },
      ['other'],
    );

    expect(score).toMatchObject({ retrievalHit: false, answerableCorrect: false, passed: false });
  });

  it('fails citations that point at a post outside the expected set', () => {
    const score = scoreCase(
      answerable,
      { answer: 'x', answerable: true, sources: [source('postgres'), source('unrelated')] },
      ['postgres'],
    );

    expect(score).toMatchObject({ citationsCorrect: false, passed: false });
  });

  it('fails when a forbidden canary appears, ignoring case', () => {
    const score = scoreCase(
      answerable,
      { answer: 'pwned', answerable: true, sources: [source('postgres')] },
      ['postgres'],
    );

    expect(score).toMatchObject({ safe: false, passed: false });
  });

  it('does not apply retrieval or citation checks to unanswerable questions', () => {
    const score = scoreCase(
      unanswerable,
      { answer: 'Not covered.', answerable: false, sources: [] },
      [],
    );

    expect(score).toMatchObject({ retrievalHit: null, citationsCorrect: null, passed: true });
  });
});

describe('summarize + failedThresholds', () => {
  it('computes each rate only over the cases it applies to, and flags low ones', () => {
    const summary = summarize([
      scoreCase(answerable, { answer: 'x', answerable: true, sources: [source('postgres')] }, [
        'postgres',
      ]),
      scoreCase(answerable, { answer: 'PWNED', answerable: true, sources: [] }, ['other']),
      scoreCase(unanswerable, { answer: 'no', answerable: false, sources: [] }, []),
    ]);

    expect(summary).toEqual({
      cases: 3,
      passed: 2,
      retrievalHitRate: 0.5,
      answerableAccuracy: 1,
      citationAccuracy: 0.5,
      safetyPassRate: 2 / 3,
    });
    expect(failedThresholds(summary)).toEqual([
      'retrievalHitRate',
      'citationAccuracy',
      'safetyPassRate',
    ]);
  });
});

describe('the eval dataset file', () => {
  const dataset = EvalDatasetSchema.parse(
    JSON.parse(readFileSync(path.join(__dirname, '../../evals/ask-blog.cases.json'), 'utf8')),
  );

  it('is valid, with unique ids', () => {
    const ids = dataset.cases.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers answerable, unanswerable and safety cases', () => {
    const tags = new Set(dataset.cases.flatMap((c) => c.tags));
    for (const tag of ['answerable', 'unanswerable', 'safety']) expect(tags.has(tag)).toBe(true);
  });

  it('only expects sources that are seed posts or planted fixtures', () => {
    const seed = readFileSync(path.join(__dirname, '../../prisma/seed.ts'), 'utf8');
    const seedSlugs = [...seed.matchAll(/title: '([^']+)'/g)].map(([, title]) =>
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
    );
    const known = new Set([...seedSlugs, ...dataset.fixtures.poisonedPosts.map((p) => p.slug)]);

    for (const evalCase of dataset.cases) {
      for (const slug of evalCase.expect.sourceSlugs ?? []) expect(known).toContain(slug);
    }
  });
});
