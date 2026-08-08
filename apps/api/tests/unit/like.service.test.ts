jest.mock('../../src/repositories/post.repository', () => ({
  postRepository: {
    findById: jest.fn(),
  },
}));

import { createLikeService } from '../../src/services/like.service';
import { postRepository } from '../../src/repositories/post.repository';
import type { LikeRepository } from '../../src/repositories/like.repository';

function mockRepository(overrides: Partial<LikeRepository> = {}): LikeRepository {
  return {
    find: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    delete: jest.fn(),
    count: jest.fn().mockResolvedValue(0),
    ...overrides,
  } as unknown as LikeRepository;
}

beforeEach(() => {
  jest.clearAllMocks();
  (postRepository.findById as jest.Mock).mockResolvedValue({ id: 'post-1' });
});

describe('likeService.toggle', () => {
  it('throws NotFoundError when the post does not exist', async () => {
    (postRepository.findById as jest.Mock).mockResolvedValue(null);
    const service = createLikeService(mockRepository());

    await expect(service.toggle('missing-post', 'user-1')).rejects.toThrow('Post not found');
  });

  it('creates a like when none exists yet, and returns liked: true', async () => {
    const repository = mockRepository({
      find: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue(1),
    });
    const service = createLikeService(repository);

    const result = await service.toggle('post-1', 'user-1');

    expect(repository.create).toHaveBeenCalledWith('post-1', 'user-1');
    expect(repository.delete).not.toHaveBeenCalled();
    expect(result).toEqual({ liked: true, likeCount: 1 });
  });

  it('removes an existing like, and returns liked: false', async () => {
    const repository = mockRepository({
      find: jest.fn().mockResolvedValue({ postId: 'post-1', userId: 'user-1' }),
      count: jest.fn().mockResolvedValue(0),
    });
    const service = createLikeService(repository);

    const result = await service.toggle('post-1', 'user-1');

    expect(repository.delete).toHaveBeenCalledWith('post-1', 'user-1');
    expect(repository.create).not.toHaveBeenCalled();
    expect(result).toEqual({ liked: false, likeCount: 0 });
  });
});

describe('likeService.getStatus', () => {
  it('reports liked: false when no like record exists', async () => {
    const repository = mockRepository({ find: jest.fn().mockResolvedValue(null) });
    const service = createLikeService(repository);

    await expect(service.getStatus('post-1', 'user-1')).resolves.toEqual({ liked: false });
  });

  it('reports liked: true when a like record exists', async () => {
    const repository = mockRepository({ find: jest.fn().mockResolvedValue({ postId: 'post-1', userId: 'user-1' }) });
    const service = createLikeService(repository);

    await expect(service.getStatus('post-1', 'user-1')).resolves.toEqual({ liked: true });
  });
});
