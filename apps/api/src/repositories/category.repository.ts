import type { Category } from '@prisma/client';
import { prisma } from '../lib/prisma';

export const categoryRepository = {
  findAll(): Promise<Category[]> {
    return prisma.category.findMany({ orderBy: { name: 'asc' } });
  },
  findByName(name: string): Promise<Category | null> {
    return prisma.category.findUnique({ where: { name } });
  },
  create(data: { name: string; slug: string }): Promise<Category> {
    return prisma.category.create({ data });
  },
};

export type CategoryRepository = typeof categoryRepository;
