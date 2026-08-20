/*
  Warnings:

  - You are about to drop the column `clerkId` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Note_userId_createdAt_idx";

-- DropIndex
DROP INDEX "note_embedding_hnsw_idx";

-- AlterTable
ALTER TABLE "Flashcard" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "writerJson" TEXT;

-- AlterTable
ALTER TABLE "NoteRecallState" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PlannerEntry" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "clerkId";

-- CreateTable
CREATE TABLE "FigureEmbedding" (
    "id" TEXT NOT NULL,
    "uploadId" TEXT NOT NULL,
    "pageIndex" INTEGER NOT NULL,
    "imageBase64" TEXT NOT NULL,
    "caption" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    "embedding" vector(512),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FigureEmbedding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyQuote" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "original" TEXT NOT NULL,
    "english" TEXT,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyQuote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FigureEmbedding_uploadId_idx" ON "FigureEmbedding"("uploadId");

-- CreateIndex
CREATE INDEX "FigureEmbedding_pageIndex_idx" ON "FigureEmbedding"("pageIndex");

-- CreateIndex
CREATE UNIQUE INDEX "DailyQuote_date_key" ON "DailyQuote"("date");

-- CreateIndex
CREATE INDEX "DailyQuote_date_idx" ON "DailyQuote"("date");

-- CreateIndex
CREATE INDEX "Note_userId_createdAt_idx" ON "Note"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "FigureEmbedding" ADD CONSTRAINT "FigureEmbedding_uploadId_fkey" FOREIGN KEY ("uploadId") REFERENCES "Upload"("id") ON DELETE CASCADE ON UPDATE CASCADE;
