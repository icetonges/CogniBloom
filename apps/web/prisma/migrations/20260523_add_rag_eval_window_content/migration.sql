-- Migration: Add sentence-window content to Chunk + RAG evaluation table

-- Add windowContent column to Chunk for sentence-window retrieval
ALTER TABLE "Chunk" ADD COLUMN IF NOT EXISTS "windowContent" TEXT;

-- Create RagEvaluation table for RAGAS-inspired quality metrics
CREATE TABLE IF NOT EXISTS "RagEvaluation" (
  "id"               TEXT NOT NULL,
  "userId"           TEXT NOT NULL,
  "sessionId"        TEXT NOT NULL,
  "query"            TEXT NOT NULL,
  "response"         TEXT NOT NULL,
  "faithfulness"     DOUBLE PRECISION,
  "answerRelevancy"  DOUBLE PRECISION,
  "contextPrecision" DOUBLE PRECISION,
  "ragUsed"          BOOLEAN NOT NULL DEFAULT false,
  "notesRetrieved"   INTEGER NOT NULL DEFAULT 0,
  "chunksRetrieved"  INTEGER NOT NULL DEFAULT 0,
  "hydeUsed"         BOOLEAN NOT NULL DEFAULT false,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RagEvaluation_pkey" PRIMARY KEY ("id")
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS "RagEvaluation_userId_idx"    ON "RagEvaluation"("userId");
CREATE INDEX IF NOT EXISTS "RagEvaluation_sessionId_idx" ON "RagEvaluation"("sessionId");
CREATE INDEX IF NOT EXISTS "RagEvaluation_createdAt_idx" ON "RagEvaluation"("createdAt");
