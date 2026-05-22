-- Add vector embedding column to Chunk (for upload RAG)
ALTER TABLE "Chunk" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- Add gen_random_uuid support (needed for upload chunk inserts)
CREATE EXTENSION IF NOT EXISTS pgcrypto;
