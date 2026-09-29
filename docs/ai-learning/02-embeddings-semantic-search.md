# Step 2 — Embeddings & semantic search

Type "how do we release apps?" in the navbar search box and find the post titled
"Shipping to production", even though the two share no words. That's search by **meaning**.

## The idea in one picture

```
WRITE TIME (post saved)                          READ TIME (someone searches)
post ──► chunkText() ──► chunks                  "how do we release apps?"
                          │                               │
                 embedDocuments()                    embedQuery()
                          │                               │
                          ▼                               ▼
               [0.12, -0.40, ...] x N            [0.10, -0.38, ...]
                          │                               │
                 PostChunk table (pgvector) ◄── nearest vectors (<=>) ──┘
                                                          │
                                                ranked posts + % match
```

## Files, and the idea each one teaches

| File | Idea |
|---|---|
| `apps/api/src/ai/chunk-text.ts` | **Chunking.** Split long posts into ~1000-char pieces with overlap, so each vector has one focused meaning. |
| `apps/api/src/ai/ai-provider.ts` | `embedDocuments` / `embedQuery` join the interface. `EMBEDDING_DIMENSIONS = 768`. |
| `apps/api/src/ai/gemini.provider.ts` | Batch embedding calls (max 100 per request), task prefixes, and a size check on every vector. |
| `prisma/migrations/…_add_post_chunks_pgvector` | `CREATE EXTENSION vector` + a `vector(768)` column. Postgres becomes a vector database. |
| `apps/api/src/repositories/post-chunk.repository.ts` | **Raw SQL** for vectors (Prisma can't do it), still parameterized, so injection-safe. |
| `apps/api/src/services/search.service.ts` | Indexing in the background, similarity threshold, **fallback to keyword search**. |
| `apps/api/src/scripts/reindex-posts.ts` | Rebuild the index for all posts (`npm run ai:reindex -w apps/api`). |
| `apps/web/src/app/search/page.tsx` | Results page, showing the mode and each post's % match. |

## Key concepts

**Embedding.** A model turns text into a list of numbers (here 768) that encodes its meaning.
Similar meanings produce vectors pointing in similar directions.

**Cosine similarity.** How close two vectors' directions are: 1 = same meaning, ~0 = unrelated.
pgvector's `<=>` operator gives cosine *distance*, so similarity = `1 - distance`.

**Asymmetric retrieval.** A query ("how to deploy?") and a document (a paragraph about deploying)
look very different. `gemini-embedding-2` embeds them differently on purpose, via prefixes:
`task: search result | query: …` vs `title: … | text: …`. Mixing them up quietly hurts quality.

**Chunking & overlap.** One vector per whole post averages all its topics together. Chunks keep
meanings sharp; overlap stops a sentence cut at a boundary from being lost.

**Index freshness.** Vectors are a *copy* of the text. Edit a post and the copy is stale until
re-indexed. Here indexing runs in the background after each save, so saving never fails
because the AI is down. The trade-off is that search can briefly lag, or miss a post if indexing failed.

**Same model, always.** Vectors from different models (or different sizes) are not comparable.
Changing `GEMINI_EMBEDDING_MODEL` means re-indexing everything.

**Graceful degradation.** No key, quota exhausted, Gemini down? Search falls back to plain keyword
matching and the page says so. Worse results beat an error page.

**Exact vs approximate search.** We compare the query with *every* chunk. That's fine for
thousands of chunks. At millions you'd add an approximate index (pgvector's HNSW).

## Run it

1. Postgres must have pgvector. Docker Compose and CI now use `pgvector/pgvector:pg16`. A hosted DB
   (e.g. Supabase) must have the `vector` extension available.
2. `npx prisma migrate deploy` (from `apps/api`) to create the `PostChunk` table.
3. Put `GEMINI_API_KEY` in `apps/api/.env`, then index the existing posts:
   `npm run ai:reindex -w apps/api`
4. Search from the navbar. Try queries that share *no words* with a post's title.

## Try it yourself (exercises)

1. **Tune the threshold.** Search for something unrelated ("chocolate cake"). What % match do the
   results get? Adjust `MIN_SIMILARITY` in `search.service.ts` until junk disappears but real
   matches stay. This is your first taste of *evaluation*.
2. Compare `?q=postgres` with and without the key. Which queries does keyword search win on? (Hint:
   exact names and codes.) Real systems often combine both: "hybrid search".
3. Change `maxChars` in `chunkText` to 300, re-index, and search again. What changes?
4. Right now search is public and every query costs an embedding call. How could someone abuse
   that, and what would you add? (Step 4 covers this.)
