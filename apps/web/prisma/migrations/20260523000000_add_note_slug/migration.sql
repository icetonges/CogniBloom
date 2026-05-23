-- Add slug and subjectIndex columns to Note
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "Note" ADD COLUMN IF NOT EXISTS "subjectIndex" INTEGER;

-- Backfill: assign slugs to existing notes
WITH normalized AS (
  SELECT
    id,
    TO_CHAR("createdAt" AT TIME ZONE 'UTC', 'YYYYMMDD') AS date_prefix,
    TRIM(BOTH '-' FROM
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          LOWER(COALESCE(subject, 'note')),
          '[^a-z0-9]+', '-', 'g'
        ),
        '^-+|-+$', '', 'g'
      )
    ) AS subject_slug,
    ROW_NUMBER() OVER (
      PARTITION BY LOWER(COALESCE(subject, 'note'))
      ORDER BY "createdAt"
    ) AS idx
  FROM "Note"
  WHERE "userId" = 'daniel'
)
UPDATE "Note" n
SET
  "slug" = norm.date_prefix || '-' || norm.subject_slug || '-' || LPAD(norm.idx::text, 3, '0'),
  "subjectIndex" = norm.idx::integer
FROM normalized norm
WHERE n.id = norm.id AND n."slug" IS NULL;

-- Unique index
CREATE UNIQUE INDEX IF NOT EXISTS "Note_slug_key" ON "Note"("slug");
CREATE INDEX IF NOT EXISTS "Note_slug_idx" ON "Note"("slug");
CREATE INDEX IF NOT EXISTS "Note_subject_idx" ON "Note"("subject");
CREATE INDEX IF NOT EXISTS "Note_userId_createdAt_idx" ON "Note"("userId", "createdAt" DESC);
