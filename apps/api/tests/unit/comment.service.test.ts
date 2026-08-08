jest.mock('../../src/repositories/post.repository', () => ({
  postRepository: {
    findById: jest.fn(),
  },
}));

import { createCommentService } from '../../src/services/comment.service';
import { postRepository } from '../../src/repositories/post.repository';
import type { CommentRepository } from '../../src/repositories/comment.repository';

function mockRepository(overrides: Partial<CommentRepository> = {}): CommentRepository {
  return {
    findByPostId: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn(),
    delete: jest.fn(),
    ...overrides,
  } as unknown as CommentRepository;
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('commentService.addComment', () => {
  it('throws NotFoundError when the post does not exist', async () => {
    (postRepository.findById as jest.Mock).mockResolvedValue(null);
    const service = createCommentService(mockRepository());

    await expect(service.addComment('missing-post', 'user-1', 'Hi')).rejects.toThrow('Post not found');
  });

  it('creates the comment when the post exists', async () => {
    (postRepository.findById as jest.Mock).mockResolvedValue({ id: 'post-1' });
    const repository = mockRepository({ create: jest.fn().mockResolvedValue({ id: 'c1', content: 'Hi' }) });
    const service = createCommentService(repository);

    await service.addComment('post-1', 'user-1', 'Hi');

    expect(repository.create).toHaveBeenCalledWith({ content: 'Hi', postId: 'post-1', authorId: 'user-1' });
  });
});

describe('commentService.deleteComment', () => {
  it('throws NotFoundError when the comment does not exist', async () => {
    const service = createCommentService(mockRepository());

    await expect(service.deleteComment('missing', 'user-1')).rejects.toThrow('Comment not found');
  });

  it('throws ForbiddenError when the caller does not own the comment', async () => {
    const repository = mockRepository({
      findById: jest.fn().mockResolvedValue({ id: 'c1', authorId: 'someone-else' }),
    });
    const service = createCommentService(repository);

    await expect(service.deleteComment('c1', 'user-1')).rejects.toThrow(
      'You can only delete your own comments',
    );
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('deletes when the caller owns the comment', async () => {
    const repository = mockRepository({
      findById: jest.fn().mockResolvedValue({ id: 'c1', authorId: 'user-1' }),
    });
    const service = createCommentService(repository);

    await service.deleteComment('c1', 'user-1');

    expect(repository.delete).toHaveBeenCalledWith('c1');
  });
});
