# Design Pattern: Repository

## Problem

`post.service.ts` called `prisma.post.findMany(...)` directly. Two costs:

1. **Unit tests needed a real database.** Testing "does `updatePost` reject a non-author?" meant
   booting Postgres and seeding rows — for an authorization check that has nothing to do with SQL.
2. **The ORM leaked into business logic.** Prisma query shapes sat in the same functions as the
   actual rules (ownership, slug uniqueness), making both harder to read.

## Fix

Each table gets a thin repository in `apps/api/src/repositories/`. These are the **only** modules
allowed to import `prisma`.

```ts
// post.repository.ts
export const postRepository = {
  findMany(filter?: { authorId?: string; categorySlug?: string }) { ... },
  findBySlug(slug: string) { ... },
  findById(id: string) { ... },
  create(data: Prisma.PostUncheckedCreateInput) { ... },
  update(id: string, data: Prisma.PostUncheckedUpdateInput) { ... },
  delete(id: string) { ... },
};
```

Services take the repository as a defaulted parameter — dependency injection without a container:

```ts
// post.service.ts
export function createPostService(repository: PostRepository = postRepository) {
  return {
    async updatePost(id: string, userId: string, input: UpdatePostInput) {
      const post = await repository.findById(id);
      if (!post) throw new NotFoundError('Post not found');
      if (post.authorId !== userId) throw new ForbiddenError('You can only edit your own posts');
      return repository.update(id, { ... });
    },
  };
}

export const postService = createPostService(); // used by routes
```

## Payoff

Tests inject a mock instead of touching Postgres:

```ts
const repository = mockRepository({
  findById: jest.fn().mockResolvedValue({ id: 'p1', authorId: 'someone-else' }),
});

await expect(createPostService(repository).updatePost('p1', 'user-1', { title: 'X' }))
  .rejects.toThrow('You can only edit your own posts');
```

`tests/unit/` covers auth, post, comment, and like services this way — seconds, no network. The
Supertest integration tests in `tests/` still verify the real HTTP-to-Postgres path. Every resource
follows the same shape, so adding comments, categories, and likes meant one repository + service
pair each, not a new pattern each time.

## Secondary pattern: Singleton

`apps/api/src/lib/prisma.ts` keeps one `PrismaClient` on `global` outside production:

```ts
const globalForPrisma = global as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

`tsx watch` rebuilds the module graph on every save. Without this, each reload would create a new
client and a new connection pool while the old one is never closed — exhausting Postgres's
connection limit within a normal dev session.
