import type { SearchMode } from '@av-blog/shared';
import { AiProviderError, createAiProvider, type AiProvider } from '../ai';
import { chunkText } from '../ai/chunk-text';
import {
  postChunkRepository as defaultChunkRepository,
  type PostChunkRepository,
} from '../repositories/post-chunk.repository';
import {
  postRepository as defaultPostRepository,
  type PostRepository,
} from '../repositories/post.repository';
import { createRateLimiter, type RateLimiter } from '../utils/rate-limiter';

// Below this cosine similarity a post counts as "not related". The right value depends on
// the embedding model and your content: try real queries and tune it (see the learning notes).
export const MIN_SIMILARITY = 0.5;

type IndexablePost = { id: string; title: string; content: string };

type SearchServiceDeps = {
  provider?: AiProvider | null;
  // Caps semantic searches across ALL visitors. Search is public, and search pages are rendered
  // on the Next.js server, so the API can't tell visitors apart; a global cap still protects the
  // quota. Over the cap, search degrades to keyword mode instead of failing.
  semanticLimiter?: RateLimiter;
  chunkRepository?: PostChunkRepository;
  postRepository?: PostRepository;
};

export function createSearchService({
  provider = createAiProvider(),
  chunkRepository = defaultChunkRepository,
  postRepository = defaultPostRepository,
  semanticLimiter = createRateLimiter({ limit: 60, windowMs: 60_000 }),
}: SearchServiceDeps = {}) {
  async function indexPost(post: IndexablePost): Promise<void> {
    if (!provider) return;

    const chunks = chunkText(post.content);
    const embeddings = await provider.embedDocuments(
      chunks.map((text) => ({ title: post.title, text })),
    );
    await chunkRepository.replaceForPost(
      post.id,
      chunks.map((content, i) => ({ content, embedding: embeddings[i] })),
    );
    console.info(`[ai] indexed post=${post.id} chunks=${chunks.length}`);
  }

  async function keywordSearch(query: string, limit: number) {
    const posts = await postRepository.findManyByKeyword(query, limit);
    return {
      mode: 'keyword' as SearchMode,
      results: posts.map((post) => ({ post, similarity: null })),
    };
  }

  return {
    indexPost,

    // Called after a post is saved. Indexing must never make saving a post fail or feel slow,
    // so it runs in the background and only logs errors. The cost: search can briefly lag
    // behind an edit, or miss a post if indexing failed (rerun `npm run ai:reindex`).
    indexPostInBackground(post: IndexablePost): void {
      indexPost(post).catch((err: unknown) => {
        const reason = err instanceof Error ? err.message : String(err);
        console.warn(`[ai] indexing post=${post.id} failed: ${reason}`);
      });
    },

    async searchPosts(query: string, limit = 10) {
      if (!provider) return keywordSearch(query, limit);
      if (!semanticLimiter.tryConsume('global').allowed) {
        console.warn('[ai] semantic search limit reached, using keyword search');
        return keywordSearch(query, limit);
      }

      try {
        const queryEmbedding = await provider.embedQuery(query);
        const nearest = (await chunkRepository.findNearestPosts(queryEmbedding, limit)).filter(
          (hit) => hit.similarity >= MIN_SIMILARITY,
        );

        const posts = await postRepository.findManyByIds(nearest.map((hit) => hit.postId));
        const postsById = new Map(posts.map((post) => [post.id, post]));

        return {
          mode: 'semantic' as SearchMode,
          // Keep the database's ranking (best match first); skip posts deleted meanwhile.
          results: nearest.flatMap((hit) => {
            const post = postsById.get(hit.postId);
            return post ? [{ post, similarity: hit.similarity }] : [];
          }),
        };
      } catch (err) {
        if (!(err instanceof AiProviderError)) throw err;
        // Graceful degradation: worse results beat an error page.
        console.warn(`[ai] semantic search failed, falling back to keyword: ${err.message}`);
        return keywordSearch(query, limit);
      }
    },
  };
}

export const searchService = createSearchService();
