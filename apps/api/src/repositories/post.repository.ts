import type { Post, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

const postInclude = {
  category: true,
  _count: { select: { comments: true, likes: true } },
} satisfies Prisma.PostInclude;

function buildWhere(filter?: { authorId?: string; categorySlug?: string }): Prisma.PostWhereInput {
  return {
    ...(filter?.authorId ? { authorId: filter.authorId } : {}),
    ...(filter?.categorySlug ? { category: { slug: filter.categorySlug } } : {}),
  };
}

export const postRepository = {
  findMany(filter?: { authorId?: string; categorySlug?: string; skip?: number; take?: number }) {
    return prisma.post.findMany({
      where: buildWhere(filter),
      orderBy: { createdAt: 'desc' },
      include: postInclude,
      skip: filter?.skip,
      take: filter?.take,
    });
  },
  count(filter?: { authorId?: string; categorySlug?: string }) {
    return prisma.post.count({ where: buildWhere(filter) });
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
