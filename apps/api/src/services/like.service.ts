import { NotFoundError } from '../errors';
import { likeRepository, type LikeRepository } from '../repositories/like.repository';
import { postRepository } from '../repositories/post.repository';

export function createLikeService(repository: LikeRepository = likeRepository) {
  return {
    async getStatus(postId: string, userId: string) {
      const existing = await repository.find(postId, userId);
      return { liked: Boolean(existing) };
    },

    async toggle(postId: string, userId: string) {
      const post = await postRepository.findById(postId);
      if (!post) throw new NotFoundError('Post not found');

      const existing = await repository.find(postId, userId);
      if (existing) {
        await repository.delete(postId, userId);
      } else {
        await repository.create(postId, userId);
      }

      const likeCount = await repository.count(postId);
      return { liked: !existing, likeCount };
    },
  };
}

export const likeService = createLikeService();
