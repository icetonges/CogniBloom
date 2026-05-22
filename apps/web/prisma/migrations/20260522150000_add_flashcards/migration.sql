-- CreateTable: Flashcard
CREATE TABLE IF NOT EXISTS "Flashcard" (
    "id"             TEXT NOT NULL,
    "userId"         TEXT NOT NULL,
    "noteId"         TEXT,
    "front"          TEXT NOT NULL,
    "back"           TEXT NOT NULL,
    "subject"        TEXT,
    "tags"           TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "easeFactor"     DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "interval"       INTEGER NOT NULL DEFAULT 0,
    "repetitions"    INTEGER NOT NULL DEFAULT 0,
    "nextReviewAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalReviews"   INTEGER NOT NULL DEFAULT 0,
    "correctReviews" INTEGER NOT NULL DEFAULT 0,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);

-- CreateTable: FlashcardReview
CREATE TABLE IF NOT EXISTS "FlashcardReview" (
    "id"                   TEXT NOT NULL,
    "flashcardId"          TEXT NOT NULL,
    "rating"               INTEGER NOT NULL,
    "previousInterval"     INTEGER NOT NULL,
    "previousEaseFactor"   DOUBLE PRECISION NOT NULL,
    "newInterval"          INTEGER NOT NULL,
    "newEaseFactor"        DOUBLE PRECISION NOT NULL,
    "reviewedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlashcardReview_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: Flashcard -> User
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Flashcard -> Note (nullable)
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_noteId_fkey"
    FOREIGN KEY ("noteId") REFERENCES "Note"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: FlashcardReview -> Flashcard
ALTER TABLE "FlashcardReview" ADD CONSTRAINT "FlashcardReview_flashcardId_fkey"
    FOREIGN KEY ("flashcardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Flashcard_userId_idx" ON "Flashcard"("userId");
CREATE INDEX IF NOT EXISTS "Flashcard_nextReviewAt_idx" ON "Flashcard"("nextReviewAt");
CREATE INDEX IF NOT EXISTS "Flashcard_noteId_idx" ON "Flashcard"("noteId");
CREATE INDEX IF NOT EXISTS "FlashcardReview_flashcardId_idx" ON "FlashcardReview"("flashcardId");
