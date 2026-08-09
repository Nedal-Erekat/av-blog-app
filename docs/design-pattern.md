# Design Pattern: Repository

## The problem

Early on, `post.service.ts` called `prisma.post.findMany(...)` directly. Two things followed from
that:

1. **Service-layer unit tests needed a real database.** Testing "does `updatePost` reject when the
   caller isn't the author?" meant spinning up Postgres, seeding a user and a post, then asserting
   — for a pure authorization check that has nothing to do with SQL.
2. **The ORM leaked into business logic.** Prisma's query shapes (`include`, `where` objects) were
   mixed into the same functions that also contain the actual rules (ownership, slug uniqueness,
   category resolution), making both harder to read.

## The fix

Every table has a thin repository (`apps/api/src/repositories/*.repository.ts`) that is the *only*
code allowed to import `prisma`. Each one exposes plain, intention-revealing methods:

```ts
// apps/api/src/repositories/post.repository.ts
export const postRepository = {
  findMany(filter?: { authorId?: string; categorySlug?: string }) { ... },
  findBySlug(slug: string) { ... },
  findById(id: string) { ... },
  create(data: Prisma.PostUncheckedCreateInput) { ... },
  update(id: string, data: Prisma.PostUncheckedUpdateInput) { ... },
  delete(id: string) { ... },
};
```

Services depend on the repository's **shape**, not its implementation, via a factory that defaults
to the real one but accepts an override:

```ts
// apps/api/src/services/post.service.ts
export function createPostService(repository: PostRepository = postRepository) {
  return {
    async updatePost(id: string, userId: string, input: UpdatePostInput) {
      const post = await repository.findById(id);
      if (!post) throw new NotFoundError('Post not found');
      if (post.authorId !== userId) throw new ForbiddenError('You can only edit your own posts');
      return repository.update(id, { ... });
    },
    // ...
  };
}
export const postService = createPostService(); // real instance used by routes
```

## The payoff

Tests inject a hand-written mock instead of touching Postgres:

```ts
// apps/api/tests/unit/post.service.test.ts
const repository = mockRepository({
  findById: jest.fn().mockResolvedValue({ id: 'p1', authorId: 'someone-else' }),
});
const service = createPostService(repository);

await expect(service.updatePost('p1', 'user-1', { title: 'X' }))
  .rejects.toThrow('You can only edit your own posts');
```

`apps/api/tests/unit/*.test.ts` cover `auth`, `post`, `comment`, and `like` services this way —
running in a few seconds with zero network calls, versus the equivalent integration tests in
`apps/api/tests/*.test.ts` which take tens of seconds against the real database. Both exist: the
unit tests pin down business rules cheaply and the integration tests confirm the whole
HTTP-to-Postgres path actually works.

Every table (`user`, `post`, `category`, `comment`, `like`) follows the same repository shape, so
adding features later (comments, categories, likes) meant writing one more repository + service
pair per resource rather than inventing a new pattern each time.

## Secondary pattern: Singleton (Prisma client)

`apps/api/src/lib/prisma.ts` stashes the single `PrismaClient` instance on `global` in
non-production environments:

```ts
const globalForPrisma = global as unknown as { prisma?: PrismaClient };
export const prisma = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
```

`tsx watch` hot-reloads `src/*.ts` on every save; without this, each reload would `import` a fresh
module graph and construct a brand-new `PrismaClient` — a new connection pool — while the old one
never gets torn down, quickly exhausting Postgres's connection limit during a normal dev session.
Caching the instance on `global` survives the module cache being cleared on reload.
