import type { Like } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const likeRepository = {
  find(postId: string, userId: string): Promise<Like | null> {
    return prisma.like.findUnique({ where: { postId_userId: { postId, userId } } });
  },
  create(postId: string, userId: string): Promise<Like> {
    return prisma.like.create({ data: { postId, userId } });
  },
  delete(postId: string, userId: string): Promise<Like> {
    return prisma.like.delete({ where: { postId_userId: { postId, userId } } });
  },
  count(postId: string): Promise<number> {
    return prisma.like.count({ where: { postId } });
  },
};

export type LikeRepository = typeof likeRepository;
