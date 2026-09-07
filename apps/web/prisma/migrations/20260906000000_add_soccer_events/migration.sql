-- Soccer team calendar, synced from the team's published PlayMetrics .ics
-- feed (see lib/soccer-calendar-db.ts). Purely additive: one new table, no
-- changes to existing tables, no backfill.
--
-- Replaces the previously hardcoded Monday/Tuesday/Thursday practice list
-- (lib/soccer.ts PRACTICES) as the source of truth for the daily planner and
-- the Soccer dashboard page; that static list becomes only a pre-sync /
-- fallback default.

CREATE TABLE "SoccerEvent" (
    "id"            TEXT         NOT NULL,
    "externalId"    TEXT         NOT NULL,
    -- 'practice' | 'game' | 'other'
    "kind"          TEXT         NOT NULL,
    "summary"       TEXT         NOT NULL,
    "description"   TEXT,
    "location"      TEXT,
    "opponent"      TEXT,
    "venue"         TEXT,
    "uniform"       TEXT,
    "startAt"       TIMESTAMP(3) NOT NULL,
    "endAt"         TIMESTAMP(3),
    "allDay"        BOOLEAN      NOT NULL DEFAULT false,
    "status"        TEXT,
    "source"        TEXT         NOT NULL DEFAULT 'playmetrics',
    "lastSeenAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoccerEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SoccerEvent_externalId_key" ON "SoccerEvent"("externalId");
CREATE INDEX "SoccerEvent_kind_idx" ON "SoccerEvent"("kind");
CREATE INDEX "SoccerEvent_startAt_idx" ON "SoccerEvent"("startAt");
CREATE INDEX "SoccerEvent_kind_startAt_idx" ON "SoccerEvent"("kind", "startAt");
