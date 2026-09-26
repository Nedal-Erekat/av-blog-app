import { AiProviderError, type AiProvider } from '../../src/ai';
import type { PostChunkRepository } from '../../src/repositories/post-chunk.repository';
import type { PostRepository } from '../../src/repositories/post.repository';
import { createSearchService, MIN_SIMILARITY } from '../../src/services/search.service';
import { createRateLimiter } from '../../src/utils/rate-limiter';

const post = (id: string) => ({ id, title: `Post ${id}` });

function fakeProvider(overrides: Partial<AiProvider> = {}): AiProvider {
  return {
    generateJson: jest.fn(),
    embedDocuments: jest.fn(async (docs) => docs.map(() => [0.1, 0.2])),
    embedQuery: jest.fn().mockResolvedValue([0.3, 0.4]),
    chat: jest.fn(),
    ...overrides,
  };
}

function fakeChunkRepository(overrides: Partial<PostChunkRepository> = {}): PostChunkRepository {
  return {
    replaceForPost: jest.fn().mockResolvedValue(undefined),
    findNearestPosts: jest.fn().mockResolvedValue([]),
    ...overrides,
  } as PostChunkRepository;
}

function fakePostRepository(overrides: Partial<PostRepository> = {}): PostRepository {
  return {
    findManyByIds: jest.fn(async (ids: string[]) => ids.map(post)),
    findManyByKeyword: jest.fn().mockResolvedValue([post('kw')]),
    ...overrides,
  } as unknown as PostRepository;
}

beforeEach(() => {
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('searchService.searchPosts', () => {
  it('ranks posts by similarity and drops those below the threshold', async () => {
    const chunkRepository = fakeChunkRepository({
      findNearestPosts: jest.fn().mockResolvedValue([
        { postId: 'b', similarity: 0.9 },
        { postId: 'a', similarity: 0.7 },
        { postId: 'c', similarity: MIN_SIMILARITY - 0.01 },
      ]),
    });
    const service = createSearchService({
      provider: fakeProvider(),
      chunkRepository,
      postRepository: fakePostRepository({
        // The database returns rows in its own order; the service must restore the ranking.
        findManyByIds: jest.fn().mockResolvedValue([post('a'), post('b')]),
      }),
    });

    const { mode, results } = await service.searchPosts('deploying apps');

    expect(mode).toBe('semantic');
    expect(results.map((r) => [r.post.id, r.similarity])).toEqual([
      ['b', 0.9],
      ['a', 0.7],
    ]);
  });

  it('falls back to keyword search when the AI provider fails', async () => {
    const service = createSearchService({
      provider: fakeProvider({
        embedQuery: jest.fn().mockRejectedValue(new AiProviderError('Gemini returned HTTP 429')),
      }),
      chunkRepository: fakeChunkRepository(),
      postRepository: fakePostRepository(),
    });

    const { mode, results } = await service.searchPosts('docker');

    expect(mode).toBe('keyword');
    expect(results).toEqual([{ post: post('kw'), similarity: null }]);
  });

  it('degrades to keyword search (no embedding call) once the semantic search cap is reached', async () => {
    const provider = fakeProvider();
    const service = createSearchService({
      provider,
      chunkRepository: fakeChunkRepository(),
      postRepository: fakePostRepository(),
      semanticLimiter: createRateLimiter({ limit: 1, windowMs: 60_000 }),
    });

    expect((await service.searchPosts('first')).mode).toBe('semantic');
    expect((await service.searchPosts('second')).mode).toBe('keyword');
    expect(provider.embedQuery).toHaveBeenCalledTimes(1);
  });

  it('uses keyword search when no AI provider is configured', async () => {
    const postRepository = fakePostRepository();
    const service = createSearchService({
      provider: null,
      chunkRepository: fakeChunkRepository(),
      postRepository,
    });

    await expect(service.searchPosts('docker')).resolves.toMatchObject({ mode: 'keyword' });
    expect(postRepository.findManyByKeyword).toHaveBeenCalledWith('docker', 10);
  });

  it('does not hide unexpected (non-AI) errors behind the fallback', async () => {
    const service = createSearchService({
      provider: fakeProvider(),
      chunkRepository: fakeChunkRepository({
        findNearestPosts: jest.fn().mockRejectedValue(new Error('database down')),
      }),
      postRepository: fakePostRepository(),
    });

    await expect(service.searchPosts('docker')).rejects.toThrow('database down');
  });
});

describe('searchService.indexPost', () => {
  it('chunks the content, embeds each chunk with the title, and stores them', async () => {
    const provider = fakeProvider();
    const chunkRepository = fakeChunkRepository();
    const service = createSearchService({
      provider,
      chunkRepository,
      postRepository: fakePostRepository(),
    });

    await service.indexPost({
      id: 'p1',
      title: 'Docker',
      content: 'Containers.\n\nMore containers.',
    });

    expect(provider.embedDocuments).toHaveBeenCalledWith([
      { title: 'Docker', text: 'Containers. More containers.' },
    ]);
    expect(chunkRepository.replaceForPost).toHaveBeenCalledWith('p1', [
      { content: 'Containers. More containers.', embedding: [0.1, 0.2] },
    ]);
  });

  it('does nothing when no AI provider is configured', async () => {
    const chunkRepository = fakeChunkRepository();
    const service = createSearchService({
      provider: null,
      chunkRepository,
      postRepository: fakePostRepository(),
    });

    await service.indexPost({ id: 'p1', title: 't', content: 'c' });

    expect(chunkRepository.replaceForPost).not.toHaveBeenCalled();
  });

  it('indexPostInBackground logs failures instead of throwing', async () => {
    const service = createSearchService({
      provider: fakeProvider({ embedDocuments: jest.fn().mockRejectedValue(new Error('quota')) }),
      chunkRepository: fakeChunkRepository(),
      postRepository: fakePostRepository(),
    });

    expect(() =>
      service.indexPostInBackground({ id: 'p1', title: 't', content: 'c' }),
    ).not.toThrow();
    await new Promise((resolve) => setImmediate(resolve));
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('indexing post=p1 failed: quota'),
    );
  });
});
