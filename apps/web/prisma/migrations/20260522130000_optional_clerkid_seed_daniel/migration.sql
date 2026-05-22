-- Make clerkId optional (single-user app, no Clerk auth)
ALTER TABLE "User" ALTER COLUMN "clerkId" DROP NOT NULL;

-- Drop unique/index constraints on clerkId (no longer needed)
DROP INDEX IF EXISTS "User_clerkId_key";
DROP INDEX IF EXISTS "User_clerkId_idx";

-- Seed the single app user (idempotent)
INSERT INTO "User" (
  "id", "email", "name", "role", "clerkId",
  "emailVerified", "interests",
  "createdAt", "updatedAt", "lastActiveAt"
)
VALUES (
  'daniel',
  'daniel@cognibloom.app',
  'Daniel',
  'STUDENT'::"UserRole",
  NULL,
  true,
  ARRAY[]::TEXT[],
  NOW(), NOW(), NOW()
)
ON CONFLICT ("id") DO NOTHING;
