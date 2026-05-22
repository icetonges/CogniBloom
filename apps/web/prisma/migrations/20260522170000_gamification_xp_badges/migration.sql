-- Add XP and level tracking to LearningProfile
ALTER TABLE "LearningProfile"
  ADD COLUMN IF NOT EXISTS "xp"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "level" INTEGER NOT NULL DEFAULT 1;

-- UserBadge: one row per badge Daniel has earned (unique per badge)
CREATE TABLE IF NOT EXISTS "UserBadge" (
  "id"       TEXT        NOT NULL,
  "userId"   TEXT        NOT NULL,
  "badgeId"  TEXT        NOT NULL,
  "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBadge_pkey"            PRIMARY KEY ("id"),
  CONSTRAINT "UserBadge_userId_badgeId_key" UNIQUE ("userId", "badgeId")
);

CREATE INDEX IF NOT EXISTS "UserBadge_userId_idx" ON "UserBadge"("userId");
