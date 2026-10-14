-- Writing-session time tracking for notes (lib/writing-session.ts).
-- Purely additive: one new table, no changes to existing tables, no backfill.

CREATE TABLE "NoteWritingSession" (
    "id"             TEXT         NOT NULL,
    "noteId"         TEXT         NOT NULL,
    "kind"           TEXT         NOT NULL,
    "template"       TEXT,
    "startedAt"      TIMESTAMP(3) NOT NULL,
    "endedAt"        TIMESTAMP(3) NOT NULL,
    "openMs"         INTEGER      NOT NULL DEFAULT 0,
    "foregroundMs"   INTEGER      NOT NULL DEFAULT 0,
    "awayMs"         INTEGER      NOT NULL DEFAULT 0,
    "activeMs"       INTEGER      NOT NULL DEFAULT 0,
    "idleMs"         INTEGER      NOT NULL DEFAULT 0,
    "firstInputAt"   TIMESTAMP(3),
    "lastInputAt"    TIMESTAMP(3),
    "typingSpanMs"   INTEGER      NOT NULL DEFAULT 0,
    "inputEvents"    INTEGER      NOT NULL DEFAULT 0,
    "pauseCount"     INTEGER      NOT NULL DEFAULT 0,
    "longestPauseMs" INTEGER      NOT NULL DEFAULT 0,
    "hiddenCount"    INTEGER      NOT NULL DEFAULT 0,
    "wordsStart"     INTEGER      NOT NULL DEFAULT 0,
    "wordsEnd"       INTEGER      NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteWritingSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "NoteWritingSession_noteId_startedAt_idx" ON "NoteWritingSession"("noteId", "startedAt");
CREATE INDEX "NoteWritingSession_startedAt_idx" ON "NoteWritingSession"("startedAt");

ALTER TABLE "NoteWritingSession"
    ADD CONSTRAINT "NoteWritingSession_noteId_fkey"
    FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;
