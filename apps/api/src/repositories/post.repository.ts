import type { Post, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const postRepository = {
  findMany(): Promise<Post[]> {
    return prisma.post.findMany({ orderBy: { createdAt: 'desc' } });
  },
  findBySlug(slug: string): Promise<Post | null> {
    return prisma.post.findUnique({ where: { slug } });
  },
  findById(id: string): Promise<Post | null> {
    return prisma.post.findUnique({ where: { id } });
  },
  create(data: Prisma.PostUncheckedCreateInput): Promise<Post> {
    return prisma.post.create({ data });
  },
  update(id: string, data: Prisma.PostUncheckedUpdateInput): Promise<Post> {
    return prisma.post.update({ where: { id }, data });
  },
  delete(id: string): Promise<Post> {
    return prisma.post.delete({ where: { id } });
  },
};

export type PostRepository = typeof postRepository;
