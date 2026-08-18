import { createId } from '@paralleldrive/cuid2';
import { relations } from 'drizzle-orm';
import { foreignKey, index, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';

// Table and column names are quoted PascalCase/camelCase to match the schema the
// previous Prisma migrations created. Keeping them byte-identical means this is a
// pure application-layer swap: no table is renamed, no row is rewritten.

// Foreign keys are declared with explicit names (`Post_authorId_fkey`, ...) rather
// than inline `.references()`, which would auto-name them `Post_authorId_User_id_fk`.
// Matching Prisma's names lets 0000_init guard each constraint with a duplicate_object
// catch and land cleanly on a database the old migrations already built.

// cuid generation lives in the application, not the database — same as Prisma's
// `@default(cuid())`. New rows get cuid2 ids; existing cuid v1 ids stay valid,
// since both are opaque TEXT to Postgres.
const id = () =>
  text('id')
    .primaryKey()
    .$defaultFn(() => createId());

export const users = pgTable(
  'User',
  {
    id: id(),
    email: text('email').notNull(),
    passwordHash: text('passwordHash').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('User_email_key').on(table.email)],
);

export const categories = pgTable(
  'Category',
  {
    id: id(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
  },
  (table) => [uniqueIndex('Category_name_key').on(table.name), uniqueIndex('Category_slug_key').on(table.slug)],
);

export const posts = pgTable(
  'Post',
  {
    id: id(),
    title: text('title').notNull(),
    slug: text('slug').notNull(),
    content: text('content').notNull(),
    excerpt: text('excerpt').notNull(),
    authorId: text('authorId').notNull(),
    categoryId: text('categoryId'),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
    // Prisma's `@updatedAt` was applied by the client, not by a DB default or
    // trigger. `$defaultFn` covers inserts and `$onUpdate` covers updates, so the
    // column keeps working against databases created by the old migrations.
    updatedAt: timestamp('updatedAt', { precision: 3, mode: 'date' })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('Post_slug_key').on(table.slug),
    index('Post_authorId_idx').on(table.authorId),
    index('Post_categoryId_idx').on(table.categoryId),
    foreignKey({ name: 'Post_authorId_fkey', columns: [table.authorId], foreignColumns: [users.id] })
      .onDelete('cascade')
      .onUpdate('cascade'),
    foreignKey({ name: 'Post_categoryId_fkey', columns: [table.categoryId], foreignColumns: [categories.id] })
      .onDelete('set null')
      .onUpdate('cascade'),
  ],
);

export const comments = pgTable(
  'Comment',
  {
    id: id(),
    content: text('content').notNull(),
    postId: text('postId').notNull(),
    authorId: text('authorId').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    index('Comment_postId_idx').on(table.postId),
    foreignKey({ name: 'Comment_postId_fkey', columns: [table.postId], foreignColumns: [posts.id] })
      .onDelete('cascade')
      .onUpdate('cascade'),
    foreignKey({ name: 'Comment_authorId_fkey', columns: [table.authorId], foreignColumns: [users.id] })
      .onDelete('cascade')
      .onUpdate('cascade'),
  ],
);

export const likes = pgTable(
  'Like',
  {
    postId: text('postId').notNull(),
    userId: text('userId').notNull(),
    createdAt: timestamp('createdAt', { precision: 3, mode: 'date' }).notNull().defaultNow(),
  },
  (table) => [
    // Composite primary key: one row per (post, user) pair is what makes
    // "a user can like a post at most once" a database guarantee.
    primaryKey({ name: 'Like_pkey', columns: [table.postId, table.userId] }),
    foreignKey({ name: 'Like_postId_fkey', columns: [table.postId], foreignColumns: [posts.id] })
      .onDelete('cascade')
      .onUpdate('cascade'),
    foreignKey({ name: 'Like_userId_fkey', columns: [table.userId], foreignColumns: [users.id] })
      .onDelete('cascade')
      .onUpdate('cascade'),
  ],
);

// Relations power the `db.query.*` API used by the repositories.
export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
  comments: many(comments),
  likes: many(likes),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  posts: many(posts),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  category: one(categories, { fields: [posts.categoryId], references: [categories.id] }),
  comments: many(comments),
  likes: many(likes),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  post: one(posts, { fields: [likes.postId], references: [posts.id] }),
  user: one(users, { fields: [likes.userId], references: [users.id] }),
}));

export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Like = typeof likes.$inferSelect;

export type NewPost = typeof posts.$inferInsert;
