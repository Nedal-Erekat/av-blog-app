import request from 'supertest';
import { EMBEDDING_DIMENSIONS, type AiProvider, type Embedding } from '../src/ai';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { postChunkRepository } from '../src/repositories/post-chunk.repository';
import { createSearchService } from '../src/services/search.service';

// These tests run against the real Postgres + pgvector, so the raw SQL is exercised for real.
// Instead of calling Gemini they use hand-made vectors whose similarities we know exactly.

const app = createApp();
const unique = `${Date.now()}${Math.random().toString(36).slice(2)}`;
let authorId: string;
const postIds: string[] = [];

// A vector pointing along one axis. Two different axes are unrelated (cosine similarity 0).
function axis(...weights: [index: number, weight: number][]): Embedding {
  const vector = Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  for (const [index, weight] of weights) vector[index] = weight;
  return vector;
}

async function createPost(title: string, content: string) {
  const post = await prisma.post.create({
    data: {
      title,
      content,
      excerpt: content.slice(0, 50),
      slug: `${unique}-${postIds.length}`,
      authorId,
    },
  });
  postIds.push(post.id);
  return post;
}

beforeAll(async () => {
  const user = await prisma.user.create({
    data: { email: `search-${unique}@example.com`, name: 'Searcher', passwordHash: 'x' },
  });
  authorId = user.id;
});

afterAll(async () => {
  // Deleting the user cascades to their posts, and posts cascade to their chunks.
  await prisma.user.delete({ where: { id: authorId } });
  await prisma.$disconnect();
});

describe('postChunkRepository (pgvector)', () => {
  it('ranks posts by cosine similarity, scoring each post by its best chunk', async () => {
    const docker = await createPost('Docker', 'containers');
    const cooking = await createPost('Cooking', 'cake');
    await postChunkRepository.replaceForPost(docker.id, [
      { content: 'intro', embedding: axis([5, 1]) },
      { content: 'containers', embedding: axis([0, 1]) },
    ]);
    await postChunkRepository.replaceForPost(cooking.id, [
      { content: 'cake', embedding: axis([1, 1]) },
    ]);

    // Mostly "axis 0" (docker) and a bit of "axis 1" (cooking): cos = 0.8 and 0.6.
    const nearest = await postChunkRepository.findNearestPosts(axis([0, 0.8], [1, 0.6]), 50);
    const ours = nearest.filter((hit) => postIds.includes(hit.postId));

    expect(ours.map((hit) => hit.postId)).toEqual([docker.id, cooking.id]);
    expect(ours[0].similarity).toBeCloseTo(0.8, 5);
    expect(ours[1].similarity).toBeCloseTo(0.6, 5);
  });

  it('replaces old chunks when a post is re-indexed', async () => {
    const post = await createPost('Evolving', 'v1');
    await postChunkRepository.replaceForPost(post.id, [
      { content: 'a', embedding: axis([2, 1]) },
      { content: 'b', embedding: axis([3, 1]) },
    ]);
    await postChunkRepository.replaceForPost(post.id, [{ content: 'c', embedding: axis([4, 1]) }]);

    const chunks = await prisma.postChunk.findMany({ where: { postId: post.id } });
    expect(chunks.map((c) => c.content)).toEqual(['c']);
  });
});

describe('postChunkRepository.findNearestChunks (pgvector)', () => {
  it('returns the closest passages with their post title and slug, best first', async () => {
    const post = await createPost('RAG source', 'passages');
    await postChunkRepository.replaceForPost(post.id, [
      { content: 'far passage', embedding: axis([10, 1]) },
      { content: 'close passage', embedding: axis([11, 1]) },
    ]);

    const chunks = await postChunkRepository.findNearestChunks(axis([11, 0.8], [10, 0.6]), 50);
    const ours = chunks.filter((c) => c.postId === post.id);

    expect(ours.map((c) => c.content)).toEqual(['close passage', 'far passage']);
    expect(ours[0]).toMatchObject({ title: 'RAG source', slug: post.slug });
    expect(ours[0].similarity).toBeCloseTo(0.8, 5);
  });
});

describe('searchService with real repositories', () => {
  it('finds a post by meaning, end to end', async () => {
    const post = await createPost('Shipping to production', 'We deploy with containers.');
    // A fake "model" that puts deployment-related text on axis 7.
    const provider: AiProvider = {
      generateJson: jest.fn(),
      embedDocuments: async (docs) => docs.map(() => axis([7, 1])),
      embedQuery: async () => axis([7, 1]),
      chat: jest.fn(),
    };
    jest.spyOn(console, 'info').mockImplementation(() => undefined);
    const service = createSearchService({ provider });

    await service.indexPost(post);
    const { mode, results } = await service.searchPosts('how do we release apps?', 50);

    expect(mode).toBe('semantic');
    expect(results[0]).toMatchObject({ post: { id: post.id, title: 'Shipping to production' } });
    expect(results[0].similarity).toBeCloseTo(1, 5);
  });
});

describe('GET /api/posts/search', () => {
  it('falls back to keyword search when AI is not configured', async () => {
    const post = await createPost(`Keyword ${unique}`, 'findable');

    const res = await request(app).get('/api/posts/search').query({ q: unique });

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('keyword');
    expect(res.body.results).toEqual([
      expect.objectContaining({ post: expect.objectContaining({ id: post.id }), similarity: null }),
    ]);
  });

  it('rejects a query that is too short', async () => {
    const res = await request(app).get('/api/posts/search').query({ q: 'a' });

    expect(res.status).toBe(400);
  });
});

describe('POST /api/ai/ask', () => {
  it('requires login', async () => {
    const res = await request(app).post('/api/ai/ask').send({ question: 'Why Postgres?' });

    expect(res.status).toBe(401);
  });

  it('validates the question, then answers 503 when AI is not configured', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ email: `ask-${unique}@example.com`, password: 'password123', name: 'Asker' });

    expect((await agent.post('/api/ai/ask').send({ question: 'x' })).status).toBe(400);
    expect((await agent.post('/api/ai/ask').send({ question: 'Why Postgres?' })).status).toBe(503);

    await prisma.user.delete({ where: { email: `ask-${unique}@example.com` } });
  });
});
