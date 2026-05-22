-- Enable pgvector extension (Neon supports this natively)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to Note (768 dims = Google text-embedding-004)
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- HNSW index for fast approximate nearest-neighbour cosine search
CREATE INDEX IF NOT EXISTS "note_embedding_hnsw_idx"
ON "Note" USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
