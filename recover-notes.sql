-- ============================================================================
-- CogniBloom — find and recover Daniel's notes
--
-- Run these in the Neon SQL Editor (console.neon.tech → your project → SQL
-- Editor), against the `neondb` database.
--
-- STEP 1 and STEP 2 are READ-ONLY. Run them first and read the output before
-- running anything in STEP 3. Nothing below deletes anything.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Do the notes still exist, and who owns them?
--
-- This is the question that decides everything. If ANY rows come back, the
-- notes were never deleted — they are just owned by a User row that the app
-- is no longer logging you in as, and STEP 3A fixes it in one statement.
-- ────────────────────────────────────────────────────────────────────────────

SELECT
    n."userId",
    u.email,
    u.name,
    COUNT(*)                AS note_count,
    MIN(n."createdAt")::date AS oldest_note,
    MAX(n."createdAt")::date AS newest_note
FROM "Note" n
LEFT JOIN "User" u ON u.id = n."userId"
GROUP BY n."userId", u.email, u.name
ORDER BY note_count DESC;


-- ────────────────────────────────────────────────────────────────────────────
-- STEP 2 — What user rows exist, and which one does Google sign-in point at?
--
-- Expect to see a row with id = 'daniel' (the original seeded account). If you
-- also see a cuid-style row (e.g. 'cmxyz...') with the same email, that is the
-- "throwaway" account — and if the note_count above sits on THAT id, the notes
-- are alive and STEP 3A is all you need.
-- ────────────────────────────────────────────────────────────────────────────

SELECT
    u.id,
    u.email,
    u.name,
    u.role,
    u."createdAt",
    (SELECT COUNT(*) FROM "Note"         WHERE "userId" = u.id) AS notes,
    (SELECT COUNT(*) FROM "PlannerEntry" WHERE "userId" = u.id) AS planner_rows,
    (SELECT COUNT(*) FROM "Flashcard"    WHERE "userId" = u.id) AS flashcards,
    (SELECT COUNT(*) FROM "TutorSession" WHERE "userId" = u.id) AS tutor_sessions
FROM "User" u
ORDER BY u."createdAt";

-- Which User row each Google login is currently bound to:
SELECT a.provider, a."providerAccountId", a."userId", u.email
FROM "Account" a
LEFT JOIN "User" u ON u.id = a."userId";


-- ────────────────────────────────────────────────────────────────────────────
-- STEP 3A — RECOVERY, case "notes exist under the wrong user"
--
-- Only run this if STEP 1 showed notes under an id that is NOT 'daniel'.
-- Replace <WRONG_ID> with that id. This moves every piece of Daniel's work
-- onto the shared 'daniel' account. It is a move, not a copy — nothing is lost.
--
-- Run it as one transaction so it either all lands or none of it does.
-- ────────────────────────────────────────────────────────────────────────────

-- BEGIN;
--
-- UPDATE "Note"            SET "userId" = 'daniel' WHERE "userId" = '<WRONG_ID>';
-- UPDATE "PlannerEntry"    SET "userId" = 'daniel' WHERE "userId" = '<WRONG_ID>';
-- UPDATE "Flashcard"       SET "userId" = 'daniel' WHERE "userId" = '<WRONG_ID>';
-- UPDATE "TutorSession"    SET "userId" = 'daniel' WHERE "userId" = '<WRONG_ID>';
-- UPDATE "Quiz"            SET "userId" = 'daniel' WHERE "userId" = '<WRONG_ID>';
-- UPDATE "Upload"          SET "userId" = 'daniel' WHERE "userId" = '<WRONG_ID>';
-- UPDATE "NoteReview"      SET "userId" = 'daniel' WHERE "userId" = '<WRONG_ID>';
-- UPDATE "NoteRecallState" SET "userId" = 'daniel' WHERE "userId" = '<WRONG_ID>';
-- UPDATE "DailyReport"     SET "userId" = 'daniel' WHERE "userId" = '<WRONG_ID>';
-- UPDATE "LearningProfile" SET "userId" = 'daniel' WHERE "userId" = '<WRONG_ID>';
-- UPDATE "UserBadge"       SET "userId" = 'daniel' WHERE "userId" = '<WRONG_ID>';
-- UPDATE "FeedEngagement"  SET "userId" = 'daniel' WHERE "userId" = '<WRONG_ID>';
-- UPDATE "Account"         SET "userId" = 'daniel' WHERE "userId" = '<WRONG_ID>';
--
-- -- Check the counts look right BEFORE committing:
-- SELECT (SELECT COUNT(*) FROM "Note" WHERE "userId" = 'daniel') AS daniel_notes,
--        (SELECT COUNT(*) FROM "Note" WHERE "userId" = '<WRONG_ID>') AS leftover;
--
-- COMMIT;    -- or ROLLBACK; if the numbers look wrong


-- ────────────────────────────────────────────────────────────────────────────
-- STEP 3B — RECOVERY, case "the Note table really is empty"
--
-- Do NOT run SQL for this. Use Neon's point-in-time restore, which keeps a
-- rolling history of the whole database:
--
--   1. console.neon.tech → your project → "Branches" → "New branch"
--   2. Under "Include data from", choose a point in TIME, not "Head".
--      Pick a timestamp from BEFORE the notes disappeared.
--   3. Name it something like `rescue-2026-08-20` and create it.
--      This is non-destructive: your current branch is untouched.
--   4. Open the SQL Editor against the NEW branch and run STEP 1 there to
--      confirm the notes are present at that timestamp.
--   5. Once confirmed, copy them back — easiest is `pg_dump` of just the rows
--      you need from the rescue branch, restored into the main branch:
--
--        pg_dump "<RESCUE_BRANCH_DIRECT_URL>" \
--          --data-only --table='"Note"' --table='"NoteReview"' \
--          --table='"NoteRecallState"' --table='"Flashcard"' \
--          > notes_rescue.sql
--
--        psql "<MAIN_BRANCH_DIRECT_URL>" -f notes_rescue.sql
--
--      If a primary-key conflict comes back, the row already exists — safe to
--      ignore for those specific rows.
--
-- TIME MATTERS: Neon's history window is limited (24 hours on the free plan,
-- longer on paid). Create the rescue branch FIRST — you can investigate it at
-- your leisure once it exists, but you cannot create it after the window ends.
-- ────────────────────────────────────────────────────────────────────────────


-- ────────────────────────────────────────────────────────────────────────────
-- STEP 4 — Confirm, once recovered
-- ────────────────────────────────────────────────────────────────────────────

SELECT COUNT(*) AS daniel_notes FROM "Note" WHERE "userId" = 'daniel';

SELECT subject, COUNT(*) AS n, MAX("updatedAt")::date AS last_touched
FROM "Note" WHERE "userId" = 'daniel'
GROUP BY subject ORDER BY n DESC;

SELECT title, subject, "createdAt"::date
FROM "Note" WHERE "userId" = 'daniel'
ORDER BY "createdAt" DESC LIMIT 25;
