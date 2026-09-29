import { randomUUID } from 'node:crypto';
import type { Embedding } from '../ai';
import { prisma } from '../lib/prisma';

// pgvector's text format for a vector is "[0.1,0.2,...]"; SQL casts it with ::vector.
function toVectorLiteral(embedding: Embedding): string {
  return `[${embedding.join(',')}]`;
}

export type NearestPost = { postId: string; similarity: number };

export type NearestChunk = {
  postId: string;
  title: string;
  slug: string;
  content: string;
  similarity: number;
};

// Raw SQL because Prisma doesn't support the vector type. Tagged templates ($executeRaw`...`)
// still send every ${value} as a bound parameter, so this is safe from SQL injection.
export const postChunkRepository = {
  // Replace all of a post's chunks in one transaction, so search never sees a half-indexed post.
  async replaceForPost(postId: string, chunks: { content: string; embedding: Embedding }[]) {
    await prisma.$transaction([
      prisma.postChunk.deleteMany({ where: { postId } }),
      ...chunks.map(
        (chunk, index) => prisma.$executeRaw`
          INSERT INTO "PostChunk" ("id", "postId", "chunkIndex", "content", "embedding")
          VALUES (${randomUUID()}, ${postId}, ${index}, ${chunk.content}, ${toVectorLiteral(chunk.embedding)}::vector)
        `,
      ),
    ]);
  },

  // `<=>` is pgvector's cosine distance (0 = same direction). 1 - distance = cosine similarity,
  // where higher means closer in meaning. A post scores as its best-matching chunk.
  findNearestPosts(queryEmbedding: Embedding, limit: number): Promise<NearestPost[]> {
    return prisma.$queryRaw<NearestPost[]>`
      SELECT "postId", MAX(1 - ("embedding" <=> ${toVectorLiteral(queryEmbedding)}::vector))::float8 AS "similarity"
      FROM "PostChunk"
      GROUP BY "postId"
      ORDER BY "similarity" DESC
      LIMIT ${limit}
    `;
  },

  // Chunk-level retrieval for RAG: the passages themselves (plus their post), best first.
  findNearestChunks(queryEmbedding: Embedding, limit: number): Promise<NearestChunk[]> {
    return prisma.$queryRaw<NearestChunk[]>`
      SELECT c."postId", p."title", p."slug", c."content",
             (1 - (c."embedding" <=> ${toVectorLiteral(queryEmbedding)}::vector))::float8 AS "similarity"
      FROM "PostChunk" c
      JOIN "Post" p ON p."id" = c."postId"
      ORDER BY c."embedding" <=> ${toVectorLiteral(queryEmbedding)}::vector
      LIMIT ${limit}
    `;
  },
};

export type PostChunkRepository = typeof postChunkRepository;
