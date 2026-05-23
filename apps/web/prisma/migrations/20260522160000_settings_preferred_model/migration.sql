-- AddColumn: preferredModel, grade, subjects to UserPreferences
ALTER TABLE "UserPreferences"
  ADD COLUMN IF NOT EXISTS "preferredModel" TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
  ADD COLUMN IF NOT EXISTS "grade" TEXT NOT NULL DEFAULT 'Year 9',
  ADD COLUMN IF NOT EXISTS "subjects" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "UserPreferences"
  ALTER COLUMN "preferredModel" SET DEFAULT 'gemini-2.5-flash';
