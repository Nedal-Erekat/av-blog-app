import { asc, eq } from 'drizzle-orm';
import { db } from '../db';
import { comments, type Comment } from '../db/schema';

// Mirrors the old Prisma `include`: the API contract exposes the comment author
// as a trimmed { id, name }, never the full user row.
const withAuthor = {
  author: { columns: { id: true, name: true } },
} as const;

async function findWithAuthor(id: string) {
  const comment = await db.query.comments.findFirst({ where: eq(comments.id, id), with: withAuthor });
  if (!comment) throw new Error(`Comment ${id} disappeared while being written`);
  return comment;
}

export const commentRepository = {
  findByPostId(postId: string) {
    return db.query.comments.findMany({
      where: eq(comments.postId, postId),
      orderBy: asc(comments.createdAt),
      with: withAuthor,
    });
  },
  async findById(id: string): Promise<Comment | null> {
    const comment = await db.query.comments.findFirst({ where: eq(comments.id, id) });
    return comment ?? null;
  },
  // Two statements where Prisma issued one: Drizzle's `returning()` cannot pull in
  // a joined relation, so the row is re-read with its author attached.
  async create(data: { content: string; postId: string; authorId: string }) {
    const [created] = await db.insert(comments).values(data).returning();
    return findWithAuthor(created.id);
  },
  async delete(id: string): Promise<Comment> {
    const [deleted] = await db.delete(comments).where(eq(comments.id, id)).returning();
    return deleted;
  },
};

export type CommentRepository = typeof commentRepository;
