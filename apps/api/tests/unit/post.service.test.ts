jest.mock('../../src/repositories/category.repository', () => ({
  categoryRepository: {
    findByName: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
  },
}));

import { createPostService } from '../../src/services/post.service';
import { categoryRepository } from '../../src/repositories/category.repository';
import type { PostRepository } from '../../src/repositories/post.repository';

function mockRepository(overrides: Partial<PostRepository> = {}): PostRepository {
  return {
    findMany: jest.fn().mockResolvedValue([]),
    findBySlug: jest.fn().mockResolvedValue(null),
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  } as unknown as PostRepository;
}

beforeEach(() => {
  jest.clearAllMocks();
  (categoryRepository.findByName as jest.Mock).mockResolvedValue(null);
});

describe('postService.createPost', () => {
  it('slugifies the title and derives an excerpt when none is given', async () => {
    const repository = mockRepository({ create: jest.fn().mockResolvedValue({ id: 'p1' }) });
    const service = createPostService(repository);

    await service.createPost('author-1', { title: 'Hello World!', content: 'Some body text.' });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'hello-world', excerpt: 'Some body text.', authorId: 'author-1' }),
    );
  });

  it('appends a numeric suffix when the slug is already taken', async () => {
    const repository = mockRepository({
      findBySlug: jest
        .fn()
        .mockResolvedValueOnce({ id: 'existing' })
        .mockResolvedValueOnce(null),
      create: jest.fn().mockResolvedValue({ id: 'p2' }),
    });
    const service = createPostService(repository);

    await service.createPost('author-1', { title: 'Same Title', content: 'Body.' });

    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ slug: 'same-title-2' }));
  });

  it('reuses an existing category instead of creating a duplicate', async () => {
    (categoryRepository.findByName as jest.Mock).mockResolvedValue({ id: 'cat-1', name: 'Tech' });
    const repository = mockRepository({ create: jest.fn().mockResolvedValue({ id: 'p3' }) });
    const service = createPostService(repository);

    await service.createPost('author-1', { title: 'Post', content: 'Body.', category: 'Tech' });

    expect(categoryRepository.create).not.toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ categoryId: 'cat-1' }));
  });
});

describe('postService.updatePost', () => {
  it('throws NotFoundError when the post does not exist', async () => {
    const repository = mockRepository();
    const service = createPostService(repository);

    await expect(service.updatePost('missing', 'user-1', { title: 'X' })).rejects.toThrow('Post not found');
  });

  it('throws ForbiddenError when the caller is not the author', async () => {
    const repository = mockRepository({
      findById: jest.fn().mockResolvedValue({ id: 'p1', authorId: 'someone-else' }),
    });
    const service = createPostService(repository);

    await expect(service.updatePost('p1', 'user-1', { title: 'X' })).rejects.toThrow(
      'You can only edit your own posts',
    );
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('updates only the fields provided', async () => {
    const repository = mockRepository({
      findById: jest.fn().mockResolvedValue({ id: 'p1', authorId: 'user-1' }),
      update: jest.fn().mockResolvedValue({ id: 'p1', title: 'Updated' }),
    });
    const service = createPostService(repository);

    await service.updatePost('p1', 'user-1', { title: 'Updated' });

    expect(repository.update).toHaveBeenCalledWith('p1', { title: 'Updated' });
  });
});

describe('postService.deletePost', () => {
  it('throws ForbiddenError when the caller is not the author', async () => {
    const repository = mockRepository({
      findById: jest.fn().mockResolvedValue({ id: 'p1', authorId: 'someone-else' }),
    });
    const service = createPostService(repository);

    await expect(service.deletePost('p1', 'user-1')).rejects.toThrow('You can only delete your own posts');
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('deletes when the caller is the author', async () => {
    const repository = mockRepository({
      findById: jest.fn().mockResolvedValue({ id: 'p1', authorId: 'user-1' }),
    });
    const service = createPostService(repository);

    await service.deletePost('p1', 'user-1');

    expect(repository.delete).toHaveBeenCalledWith('p1');
  });
});
