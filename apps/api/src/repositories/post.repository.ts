import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '../db';
import { categories, comments, likes, posts, type NewPost, type Post } from '../db/schema';

// Correlated subqueries reproduce Prisma's `_count` aggregate in the same round
// trip. The ::int cast matters — Postgres count() is bigint, which the driver
// would otherwise hand back as a string and break `_count.likes` for the client.
const commentCount = sql<number>`(select count(*)::int from ${comments} where ${comments.postId} = ${posts.id})`;
const likeCount = sql<number>`(select count(*)::int from ${likes} where ${likes.postId} = ${posts.id})`;

const postSelection = {
  id: posts.id,
  title: posts.title,
  slug: posts.slug,
  content: posts.content,
  excerpt: posts.excerpt,
  authorId: posts.authorId,
  categoryId: posts.categoryId,
  createdAt: posts.createdAt,
  updatedAt: posts.updatedAt,
  category: { id: categories.id, name: categories.name, slug: categories.slug },
  commentCount,
  likeCount,
};

type PostRow = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  authorId: string;
  categoryId: string | null;
  createdAt: Date;
  updatedAt: Date;
  category: { id: string; name: string; slug: string } | null;
  commentCount: number;
  likeCount: number;
};

export type PostWithRelations = Omit<PostRow, 'commentCount' | 'likeCount'> & {
  _count: { comments: number; likes: number };
};

// Reshapes the flat row into the JSON the API has always returned. `category` is
// null rather than an object of nulls when the LEFT JOIN found nothing.
function toPostResponse(row: PostRow): PostWithRelations {
  const { commentCount: commentTotal, likeCount: likeTotal, category, ...post } = row;
  return {
    ...post,
    category: category && category.id ? category : null,
    _count: { comments: commentTotal, likes: likeTotal },
  };
}

function baseQuery() {
  return db.select(postSelection).from(posts).leftJoin(categories, eq(posts.categoryId, categories.id));
}

async function selectOne(where: SQL): Promise<PostWithRelations | null> {
  const [row] = await baseQuery().where(where).limit(1);
  return row ? toPostResponse(row) : null;
}

export const postRepository = {
  async findMany(filter?: { authorId?: string; categorySlug?: string }): Promise<PostWithRelations[]> {
    const conditions: SQL[] = [];
    if (filter?.authorId) conditions.push(eq(posts.authorId, filter.authorId));
    if (filter?.categorySlug) conditions.push(eq(categories.slug, filter.categorySlug));

    const query = baseQuery().$dynamic();
    if (conditions.length > 0) query.where(and(...conditions));

    const rows = await query.orderBy(desc(posts.createdAt));
    return rows.map(toPostResponse);
  },
  findBySlug(slug: string): Promise<PostWithRelations | null> {
    return selectOne(eq(posts.slug, slug));
  },
  // Used internally for ownership checks; no relations needed.
  async findById(id: string): Promise<Post | null> {
    const post = await db.query.posts.findFirst({ where: eq(posts.id, id) });
    return post ?? null;
  },
  // Insert and update re-read the row so the response keeps its category and
  // counts — `returning()` only ever yields the post's own columns.
  async create(data: NewPost): Promise<PostWithRelations> {
    const [created] = await db.insert(posts).values(data).returning({ id: posts.id });
    return selectOne(eq(posts.id, created.id)) as Promise<PostWithRelations>;
  },
  async update(
    id: string,
    data: Partial<Pick<NewPost, 'title' | 'content' | 'excerpt' | 'categoryId'>>,
  ): Promise<PostWithRelations> {
    // `updatedAt` is set explicitly rather than left to the column's $onUpdate hook:
    // it keeps Prisma's behaviour of bumping the timestamp even for a no-op patch,
    // and guarantees the SET clause is never empty.
    await db
      .update(posts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(posts.id, id));
    return selectOne(eq(posts.id, id)) as Promise<PostWithRelations>;
  },
  async delete(id: string): Promise<Post> {
    const [deleted] = await db.delete(posts).where(eq(posts.id, id)).returning();
    return deleted;
  },
};

export type PostRepository = typeof postRepository;
