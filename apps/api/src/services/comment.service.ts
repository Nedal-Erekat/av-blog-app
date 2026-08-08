import { ForbiddenError, NotFoundError } from '../errors';
import { commentRepository, type CommentRepository } from '../repositories/comment.repository';
import { postRepository } from '../repositories/post.repository';

export function createCommentService(repository: CommentRepository = commentRepository) {
  return {
    async listComments(postId: string) {
      const post = await postRepository.findById(postId);
      if (!post) throw new NotFoundError('Post not found');
      return repository.findByPostId(postId);
    },

    async addComment(postId: string, authorId: string, content: string) {
      const post = await postRepository.findById(postId);
      if (!post) throw new NotFoundError('Post not found');
      return repository.create({ content, postId, authorId });
    },

    async deleteComment(id: string, userId: string): Promise<void> {
      const comment = await repository.findById(id);
      if (!comment) throw new NotFoundError('Comment not found');
      if (comment.authorId !== userId) throw new ForbiddenError('You can only delete your own comments');
      await repository.delete(id);
    },
  };
}

export const commentService = createCommentService();
