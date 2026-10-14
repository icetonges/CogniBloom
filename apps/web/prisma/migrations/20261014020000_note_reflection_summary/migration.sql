-- Daily Reflection summary (lib/reflection-summary.ts), generated when the
-- student finishes section 14. Purely additive: two nullable columns on Note,
-- no backfill.

ALTER TABLE "Note"
    ADD COLUMN "reflectionSummary"   JSONB,
    ADD COLUMN "reflectionSummaryAt" TIMESTAMP(3);
