import { asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { categories, type Category } from '../db/schema';

export const categoryRepository = {
  findAll(): Promise<Category[]> {
    return db.query.categories.findMany({ orderBy: asc(categories.name) });
  },
  async findByName(name: string): Promise<Category | null> {
    const category = await db.query.categories.findFirst({ where: eq(categories.name, name) });
    return category ?? null;
  },
  async create(data: { name: string; slug: string }): Promise<Category> {
    const [category] = await db.insert(categories).values(data).returning();
    return category;
  },
};

export type CategoryRepository = typeof categoryRepository;
