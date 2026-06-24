-- CreateTable
CREATE TABLE "FeedSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastPulledAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "itemsToday" INTEGER NOT NULL DEFAULT 0,
    "itemsTotal" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoryFeedItem" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sourceId" TEXT,
    "sourceName" TEXT,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT,
    "url" TEXT,
    "imageUrl" TEXT,
    "emoji" TEXT NOT NULL DEFAULT '📚',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "difficulty" TEXT NOT NULL DEFAULT 'medium',
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 3,
    "contentType" TEXT NOT NULL DEFAULT 'article',
    "author" TEXT,
    "publishedAt" TIMESTAMP(3),
    "isAiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CategoryFeedItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedSource_category_idx" ON "FeedSource"("category");

-- CreateIndex
CREATE INDEX "CategoryFeedItem_category_createdAt_idx" ON "CategoryFeedItem"("category", "createdAt");

-- CreateIndex
CREATE INDEX "CategoryFeedItem_expiresAt_idx" ON "CategoryFeedItem"("expiresAt");

-- AddForeignKey
ALTER TABLE "CategoryFeedItem" ADD CONSTRAINT "CategoryFeedItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "FeedSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;
