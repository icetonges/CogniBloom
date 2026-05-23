-- Migration: Add AI analysis and publish fields to Note model
-- Run: pnpm prisma migrate dev --name add_note_ai_fields

ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "contentFormat" TEXT NOT NULL DEFAULT 'html';
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "mindMap" TEXT;
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "reasoningHints" TEXT;
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "knowledgePoints" TEXT;
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "tutorSummary" TEXT;
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "aiAnalyzedAt" TIMESTAMP(3);
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "publishedHtml" TEXT;
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "publishedSlug" TEXT;
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

-- Unique constraint on publishedSlug
CREATE UNIQUE INDEX IF NOT EXISTS "Note_publishedSlug_key" ON "Note"("publishedSlug");

-- Index for fast slug lookups
CREATE INDEX IF NOT EXISTS "Note_publishedSlug_idx" ON "Note"("publishedSlug");
