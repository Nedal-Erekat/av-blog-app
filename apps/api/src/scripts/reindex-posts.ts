// Rebuilds the semantic search index for every post: run it once after adding
// GEMINI_API_KEY (posts written before that were never embedded), or after changing the
// embedding model or chunking (old and new vectors can't be compared).
//   npm run ai:reindex -w apps/api
import 'dotenv/config';
import { prisma } from '../lib/prisma';
import { postRepository } from '../repositories/post.repository';
import { createSearchService } from '../services/search.service';
import { createAiProvider } from '../ai';

async function main() {
  if (!createAiProvider()) {
    throw new Error('GEMINI_API_KEY is not set: nothing to index with');
  }
  const searchService = createSearchService();
  const posts = await postRepository.findAllForIndexing();

  for (const [i, post] of posts.entries()) {
    // One post at a time: slower, but gentle on the free tier's per-minute rate limit.
    // eslint-disable-next-line no-await-in-loop
    await searchService.indexPost(post);
    console.info(`${i + 1}/${posts.length} ${post.title}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
