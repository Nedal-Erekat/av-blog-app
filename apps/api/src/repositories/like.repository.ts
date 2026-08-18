import { and, count, eq } from 'drizzle-orm';
import { db } from '../db';
import { likes, type Like } from '../db/schema';

const identity = (postId: string, userId: string) => and(eq(likes.postId, postId), eq(likes.userId, userId));

export const likeRepository = {
  async find(postId: string, userId: string): Promise<Like | null> {
    const like = await db.query.likes.findFirst({ where: identity(postId, userId) });
    return like ?? null;
  },
  async create(postId: string, userId: string): Promise<Like> {
    const [like] = await db.insert(likes).values({ postId, userId }).returning();
    return like;
  },
  async delete(postId: string, userId: string): Promise<Like> {
    const [like] = await db.delete(likes).where(identity(postId, userId)).returning();
    return like;
  },
  async count(postId: string): Promise<number> {
    const [row] = await db.select({ value: count() }).from(likes).where(eq(likes.postId, postId));
    return row.value;
  },
};

export type LikeRepository = typeof likeRepository;
