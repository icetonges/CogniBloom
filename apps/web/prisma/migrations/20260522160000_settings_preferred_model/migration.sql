-- AddColumn: preferredModel, grade, subjects to UserPreferences
ALTER TABLE "UserPreferences"
  ADD COLUMN IF NOT EXISTS "preferredModel" TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  ADD COLUMN IF NOT EXISTS "grade" TEXT NOT NULL DEFAULT 'Year 9',
  ADD COLUMN IF NOT EXISTS "subjects" TEXT[] NOT NULL DEFAULT '{}';
