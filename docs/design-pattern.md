# Design Pattern: Repository

## Problem

`post.service.ts` called the ORM's query builder directly. Two costs:

1. **Unit tests needed a real database.** Testing "does `updatePost` reject a non-author?" meant
   booting Postgres and seeding rows — for an authorization check that has nothing to do with SQL.
2. **The ORM leaked into business logic.** Query shapes sat in the same functions as the actual
   rules (ownership, slug uniqueness), making both harder to read.

## Fix

Each table gets a thin repository in `apps/api/src/repositories/`. These are the **only** modules
allowed to import `db`.

```ts
// post.repository.ts
export const postRepository = {
  findMany(filter?: { authorId?: string; categorySlug?: string }) { ... },
  findBySlug(slug: string) { ... },
  findById(id: string) { ... },
  create(data: NewPost) { ... },
  update(id: string, data: Partial<Pick<NewPost, 'title' | 'content' | 'excerpt' | 'categoryId'>>) { ... },
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

## The pattern paying off

The ORM was swapped from Prisma to Drizzle without touching a single service, route, or unit test.
Every change landed in `repositories/`, `db/`, and the migration tooling; `post.service.ts` and its
tests are byte-identical across that commit. That is the boundary doing exactly what it was
introduced for.

The cost is visible in the same place. Drizzle has no `include`/`_count`, so
`post.repository.ts` reproduces that response shape itself — correlated subqueries for the counts,
a `LEFT JOIN` for the category, and one mapper that assembles the JSON. Insert and update also cost
a second statement, because `returning()` cannot pull in a joined relation. The API contract is
unchanged; the work to hold it steady moved into the repository, which is where it belongs.

## Secondary pattern: Singleton

`apps/api/src/db/index.ts` keeps one connection pool on `global` outside production:

```ts
const globalForDb = global as unknown as { client?: postgres.Sql; db?: PostgresJsDatabase<typeof schema> };
export const client = globalForDb.client ?? postgres(env.DATABASE_URL, { prepare: false });
export const db = globalForDb.db ?? drizzle(client, { schema });
if (env.NODE_ENV !== 'production') {
  globalForDb.client = client;
  globalForDb.db = db;
}
```

`tsx watch` rebuilds the module graph on every save. Without this, each reload would create a new
client and a new connection pool while the old one is never closed — exhausting Postgres's
connection limit within a normal dev session.

`closeDb()` sits alongside it because postgres.js holds its sockets open until told otherwise: test
suites and one-shot scripts call it so the process can exit.
