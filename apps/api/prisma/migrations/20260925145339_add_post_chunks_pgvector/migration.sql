-- pgvector adds the "vector" column type and distance operators such as <=> (cosine distance).
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "PostChunk" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(768) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PostChunk_postId_chunkIndex_key" ON "PostChunk"("postId", "chunkIndex");

-- AddForeignKey
ALTER TABLE "PostChunk" ADD CONSTRAINT "PostChunk_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;
