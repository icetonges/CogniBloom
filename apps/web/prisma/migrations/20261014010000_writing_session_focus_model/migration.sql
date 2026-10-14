-- Focus model for writing sessions (lib/writing-session.ts v2): time split
-- into write / think / reference / break, focus blocks, and the student's
-- check-in on save. Purely additive: new nullable or defaulted columns on the
-- table created by 20261014000000_add_note_writing_sessions. No backfill.

ALTER TABLE "NoteWritingSession"
    ADD COLUMN "writeMs"         INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "thinkMs"         INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "referenceMs"     INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "breakMs"         INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "focusMs"         INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "breakCount"      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "blocksStarted"   INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "blocksCompleted" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "selfRating"      INTEGER,
    ADD COLUMN "distractions"    TEXT[]  NOT NULL DEFAULT ARRAY[]::TEXT[],
    ADD COLUMN "timeline"        JSONB;
