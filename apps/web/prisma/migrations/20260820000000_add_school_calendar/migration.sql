-- School year calendar (FCPS 2026-2027) + manual closure overrides.
--
-- Purely additive: one new table, no changes to existing tables, no data
-- backfill. Safe to apply alongside the pending Auth.js migration.
--
-- One row per notable date. Ordinary Blue/Gray days are NOT stored — the
-- rotation lives in code and only exceptions need a row, so this table stays
-- small (about 70 rows for the year plus any snow days added later).

CREATE TABLE "SchoolCalendarDay" (
    "id"            TEXT         NOT NULL,
    "date"          DATE         NOT NULL,
    -- 'blue' | 'gray' | NULL. Set only to force a rotation half.
    "rotation"      TEXT,
    -- TRUE means students do not attend, whatever the rotation says.
    "noSchool"      BOOLEAN      NOT NULL DEFAULT false,
    "earlyRelease"  BOOLEAN      NOT NULL DEFAULT false,
    -- 'regular' | 'two-hour-delay' | 'early-release'
    "scheduleKind"  TEXT,
    -- FCPS letter code: F, QE, YE, O, OE, TW, SD, SP, H, NT
    "code"          TEXT,
    "category"      TEXT         NOT NULL DEFAULT 'instructional',
    "label"         TEXT,
    "note"          TEXT,
    -- 'fcps' for ingested rows, 'manual' for closures added by hand.
    -- The ingest only ever overwrites rows whose source is 'fcps'.
    "source"        TEXT         NOT NULL DEFAULT 'fcps',
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchoolCalendarDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SchoolCalendarDay_date_key" ON "SchoolCalendarDay"("date");
CREATE INDEX "SchoolCalendarDay_noSchool_idx" ON "SchoolCalendarDay"("noSchool");
CREATE INDEX "SchoolCalendarDay_source_idx" ON "SchoolCalendarDay"("source");
