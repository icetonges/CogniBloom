-- English 7 module: the FCPS reading list, Daniel's progress through it, and
-- per-skill mastery across the four learning layers.
--
-- Purely additive. Four new tables, no changes to any existing table, no
-- backfill. Apply with `pnpm db:migrate` (prisma migrate deploy) — NEVER with
-- `migrate dev`, which resets on drift. See docs/DATABASE-RECOVERY.md.

-- The reading-list catalog. Ingested from lib/english/books.ts, which stays
-- the source of truth; this table exists so progress can join against it.
CREATE TABLE "EnglishBook" (
    "id"          TEXT         NOT NULL,
    "slug"        TEXT         NOT NULL,
    "n"           INTEGER      NOT NULL,
    "title"       TEXT         NOT NULL,
    "subtitle"    TEXT,
    "authors"     TEXT[]       DEFAULT ARRAY[]::TEXT[],
    "year"        INTEGER      NOT NULL,
    "form"        TEXT         NOT NULL,
    "band"        TEXT         NOT NULL,
    "themes"      TEXT[]       DEFAULT ARRAY[]::TEXT[],
    "series"      TEXT,
    -- Audit trail: what the printed handout said, and how it was wrong.
    "handoutSays" TEXT,
    "correction"  TEXT,
    "ambiguity"   TEXT,
    "pairsWith"   TEXT[]       DEFAULT ARRAY[]::TEXT[],
    "source"      TEXT         NOT NULL DEFAULT 'fcps-handout-2026-27',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EnglishBook_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EnglishBook_slug_key" ON "EnglishBook"("slug");
CREATE INDEX "EnglishBook_form_idx" ON "EnglishBook"("form");
CREATE INDEX "EnglishBook_band_idx" ON "EnglishBook"("band");

-- One row per (student, book). `layer` is which of the four learning layers
-- this book is being read in — the same title can be re-read in a higher layer.
CREATE TABLE "BookProgress" (
    "id"          TEXT         NOT NULL,
    "userId"      TEXT         NOT NULL,
    "bookId"      TEXT         NOT NULL,
    "layer"       TEXT         NOT NULL DEFAULT 'required',
    "status"      TEXT         NOT NULL DEFAULT 'not_started',
    "currentPart" TEXT,
    "percent"     INTEGER      NOT NULL DEFAULT 0,
    "startedAt"   TIMESTAMP(3),
    "finishedAt"  TIMESTAMP(3),
    "rating"      INTEGER,
    "takeaway"    TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "BookProgress_userId_bookId_key" ON "BookProgress"("userId", "bookId");
CREATE INDEX "BookProgress_userId_status_idx" ON "BookProgress"("userId", "status");
CREATE INDEX "BookProgress_layer_idx" ON "BookProgress"("layer");
ALTER TABLE "BookProgress" ADD CONSTRAINT "BookProgress_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookProgress" ADD CONSTRAINT "BookProgress_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "EnglishBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A single sitting: what was read, for how long, and what the tutor worked on.
CREATE TABLE "ReadingSession" (
    "id"           TEXT         NOT NULL,
    "userId"       TEXT         NOT NULL,
    "bookId"       TEXT         NOT NULL,
    "minutes"      INTEGER      NOT NULL DEFAULT 0,
    "fromPart"     TEXT,
    "toPart"       TEXT,
    "summary"      TEXT,
    "skillsWorked" TEXT[]       DEFAULT ARRAY[]::TEXT[],
    "layer"        TEXT         NOT NULL DEFAULT 'required',
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadingSession_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ReadingSession_userId_createdAt_idx" ON "ReadingSession"("userId", "createdAt");
CREATE INDEX "ReadingSession_bookId_idx" ON "ReadingSession"("bookId");
ALTER TABLE "ReadingSession" ADD CONSTRAINT "ReadingSession_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReadingSession" ADD CONSTRAINT "ReadingSession_bookId_fkey"
    FOREIGN KEY ("bookId") REFERENCES "EnglishBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Per-skill mastery, 0-4. This is what decides whether a skill belongs in the
-- catch-up layer or the level-up layer for this particular student.
CREATE TABLE "SkillMastery" (
    "id"        TEXT         NOT NULL,
    "userId"    TEXT         NOT NULL,
    "skillId"   TEXT         NOT NULL,
    "strand"    TEXT         NOT NULL,
    "level"     INTEGER      NOT NULL DEFAULT 0,
    "evidence"  TEXT,
    "lastSeen"  TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SkillMastery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SkillMastery_userId_skillId_key" ON "SkillMastery"("userId", "skillId");
CREATE INDEX "SkillMastery_userId_level_idx" ON "SkillMastery"("userId", "level");
ALTER TABLE "SkillMastery" ADD CONSTRAINT "SkillMastery_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
