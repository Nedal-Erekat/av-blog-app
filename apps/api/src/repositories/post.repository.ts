import type { Post, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const postInclude = {
  category: true,
  _count: { select: { comments: true, likes: true } },
} satisfies Prisma.PostInclude;

export const postRepository = {
  findMany(filter?: { authorId?: string; categorySlug?: string }) {
    return prisma.post.findMany({
      where: {
        ...(filter?.authorId ? { authorId: filter.authorId } : {}),
        ...(filter?.categorySlug ? { category: { slug: filter.categorySlug } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: postInclude,
    });
  },
  findManyByIds(ids: string[]) {
    return prisma.post.findMany({ where: { id: { in: ids } }, include: postInclude });
  },
  // Plain keyword search: the fallback when semantic search is unavailable.
  findManyByKeyword(keyword: string, limit: number) {
    return prisma.post.findMany({
      where: {
        OR: [
          { title: { contains: keyword, mode: 'insensitive' } },
          { content: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: postInclude,
    });
  },
  // Every post's text, for rebuilding the search index.
  findAllForIndexing() {
    return prisma.post.findMany({ select: { id: true, title: true, content: true } });
  },
  findBySlug(slug: string) {
    return prisma.post.findUnique({ where: { slug }, include: postInclude });
  },
  // Used internally for ownership checks; no relations needed.
  findById(id: string): Promise<Post | null> {
    return prisma.post.findUnique({ where: { id } });
  },
  create(data: Prisma.PostUncheckedCreateInput) {
    return prisma.post.create({ data, include: postInclude });
  },
  update(id: string, data: Prisma.PostUncheckedUpdateInput) {
    return prisma.post.update({ where: { id }, data, include: postInclude });
  },
  delete(id: string): Promise<Post> {
    return prisma.post.delete({ where: { id } });
  },
};

export type PostRepository = typeof postRepository;
