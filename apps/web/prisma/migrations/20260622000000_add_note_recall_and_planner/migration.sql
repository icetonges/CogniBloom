-- ============ DAILY REVIEW - NOTE-LEVEL SPACED REPETITION ============

-- CreateTable: NoteRecallState
CREATE TABLE IF NOT EXISTS "NoteRecallState" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "noteId"         TEXT NOT NULL,
    "easeFactor"     DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval"       INTEGER NOT NULL DEFAULT 0,
    "repetitions"    INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastReviewedAt" TIMESTAMP(3),
    "totalReviews"   INTEGER NOT NULL DEFAULT 0,
    "correctReviews" INTEGER NOT NULL DEFAULT 0,
    "lastRating"     INTEGER,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NoteRecallState_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: NoteRecallState -> User
ALTER TABLE "NoteRecallState" ADD CONSTRAINT "NoteRecallState_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: NoteRecallState -> Note
ALTER TABLE "NoteRecallState" ADD CONSTRAINT "NoteRecallState_noteId_fkey"
    FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NoteRecallState_noteId_key" ON "NoteRecallState"("noteId");
CREATE INDEX IF NOT EXISTS "NoteRecallState_userId_idx" ON "NoteRecallState"("userId");
CREATE INDEX IF NOT EXISTS "NoteRecallState_nextReviewAt_idx" ON "NoteRecallState"("nextReviewAt");
CREATE INDEX IF NOT EXISTS "NoteRecallState_userId_nextReviewAt_idx" ON "NoteRecallState"("userId", "nextReviewAt");

-- ============ DAILY / MONTHLY PLANNER ============

-- CreateTable: PlannerEntry
CREATE TABLE IF NOT EXISTS "PlannerEntry" (
    "id"          TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "scope"       TEXT NOT NULL DEFAULT 'day',
    "date"        TIMESTAMP(3) NOT NULL,
    "title"       TEXT NOT NULL,
    "details"     TEXT,
    "tags"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "status"      TEXT NOT NULL DEFAULT 'pending',
    "priority"    TEXT NOT NULL DEFAULT 'normal',
    "color"       TEXT,
    "startTime"   TEXT,
    "sortOrder"   INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlannerEntry_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: PlannerEntry -> User
ALTER TABLE "PlannerEntry" ADD CONSTRAINT "PlannerEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlannerEntry_userId_idx" ON "PlannerEntry"("userId");
CREATE INDEX IF NOT EXISTS "PlannerEntry_userId_scope_date_idx" ON "PlannerEntry"("userId", "scope", "date");
CREATE INDEX IF NOT EXISTS "PlannerEntry_date_idx" ON "PlannerEntry"("date");
