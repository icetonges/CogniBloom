# Database recovery — and how to never need it again

## What happened on 2026-08-20

`pnpm db:migrate` at the repo root was wired to **`prisma migrate dev`**, pointed at
the production Neon database. `migrate dev` is a *development* command: when it
finds schema drift it offers to reset the database. It found drift, asked, and
was answered `yes`:

```
- Drift detected: Your database schema is not in sync with your migration history.
√ We need to reset the "public" schema at "ep-ancient-firefly-apsglukd..."
Do you want to continue? All data will be lost. ... yes
```

Every row in every table was dropped, including Daniel's notes. The schema was
then rebuilt correctly from the migration history, so **only data was lost, not
structure** — which is what makes the restore below straightforward.

The drift itself was harmless bookkeeping (two migration files edited after they
had been applied, a couple of tables and columns changed by hand). Drift is a
warning sign, never a reason to reset a database that holds real work.

---

## Recovery

### 1. Freeze the moment — do this first

Neon keeps a rolling history window. Creating a branch from a past timestamp
pins that moment permanently, so the clock stops mattering.

Neon Console → **Branches** → **New branch**

| Field | Value |
| --- | --- |
| Create from | the branch that was reset |
| Include data from | **a specific date and time** (not "Head") |
| Timestamp | a few minutes **before** the reset |
| Name | `rescue-pre-reset` |

This is non-destructive. The current branch is untouched.

### 2. Confirm the data is there

In the Neon SQL Editor, with **the rescue branch selected**:

```sql
SELECT COUNT(*) FROM "Note";

SELECT n."userId", u.email, COUNT(*) AS notes,
       MIN(n."createdAt")::date AS oldest,
       MAX(n."createdAt")::date AS newest
FROM "Note" n LEFT JOIN "User" u ON u.id = n."userId"
GROUP BY n."userId", u.email;
```

If the counts look right, continue. If the rescue branch is *also* empty, the
timestamp was too late — delete it and make another from earlier.

### 3. Copy the data back

The current branch already has the correct schema; it just has no rows. So this
is a **data-only** restore. `scripts/restore-from-branch.mjs` does it without
needing Postgres client tools installed.

Grab both connection strings from the Neon console (Connect → **direct**
connection, not pooled — pooled connections can drop long transactions).

```powershell
pnpm add -D pg

$env:SOURCE_URL = "postgresql://...rescue-pre-reset.../neondb?sslmode=require"
$env:TARGET_URL = "postgresql://...current-branch.../neondb?sslmode=require"

# Reports what it would do. Writes nothing.
node scripts/restore-from-branch.mjs --dry-run

# Do it.
node scripts/restore-from-branch.mjs
```

The script:

- copies **only columns that exist on both sides**, so the small schema
  differences between the two branches don't matter;
- copies tables **parents first**, resolved from the live foreign-key graph;
- wraps **each table in its own transaction** — a table lands whole or not at all;
- uses `ON CONFLICT DO NOTHING`, so **re-running is always safe**;
- **never deletes anything** from either database.

It finishes by printing the note count in the target.

### 4. Verify

```sql
SELECT COUNT(*) FROM "Note" WHERE "userId" = 'daniel';

SELECT subject, COUNT(*) AS n, MAX("updatedAt")::date AS last_touched
FROM "Note" GROUP BY subject ORDER BY n DESC;
```

Then open the app and check the notes render. Keep the `rescue-pre-reset` branch
for a week or two before deleting it — it costs almost nothing and it is the
only copy until you're sure.

---

## Preventing a repeat

**The root `db:migrate` script no longer runs `migrate dev`.**

| Script | What it does | Safe against production? |
| --- | --- | --- |
| `pnpm db:migrate` | `prisma migrate deploy` — applies pending migrations | **Yes.** Cannot reset. |
| `pnpm db:status` | `prisma migrate status` — reports drift, changes nothing | **Yes.** Read-only. |
| `pnpm db:migrate:new` | `prisma migrate dev --create-only` — writes a migration file without applying it | Yes — review the SQL, then apply with `db:migrate`. |

Rules worth keeping:

1. **Never run `prisma migrate dev` against a database that holds real data.**
   It is for local scratch databases only. If you need it, run it against a
   throwaway Neon branch first.
2. **If any Prisma command says "All data will be lost" — answer no.** There is
   always another way. Take a branch, investigate, then decide.
3. **Never edit a migration file after it has been applied.** That is what
   produced the drift here. Write a new migration instead.
4. **Before any schema work on production, create a Neon branch.** It takes ten
   seconds and turns a catastrophe into an inconvenience.
5. `prisma migrate deploy` runs on every Vercel build. That is correct and safe —
   it only applies migrations that have not run yet.
