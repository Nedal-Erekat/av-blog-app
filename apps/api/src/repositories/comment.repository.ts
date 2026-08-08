import type { Comment, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const commentInclude = {
  author: { select: { id: true, name: true } },
} satisfies Prisma.CommentInclude;

export const commentRepository = {
  findByPostId(postId: string) {
    return prisma.comment.findMany({
      where: { postId },
      orderBy: { createdAt: 'asc' },
      include: commentInclude,
    });
  },
  findById(id: string): Promise<Comment | null> {
    return prisma.comment.findUnique({ where: { id } });
  },
  create(data: { content: string; postId: string; authorId: string }) {
    return prisma.comment.create({ data, include: commentInclude });
  },
  delete(id: string): Promise<Comment> {
    return prisma.comment.delete({ where: { id } });
  },
};

export type CommentRepository = typeof commentRepository;
