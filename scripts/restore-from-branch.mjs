#!/usr/bin/env node
/**
 * Copy all row data from one Neon branch into another.
 *
 * Written for the 2026-08-20 incident: `prisma migrate dev` detected drift,
 * reset the public schema, and every row was dropped. The fix is to create a
 * Neon point-in-time branch from just before the reset and copy the data back
 * into the current branch, whose schema is already correct.
 *
 * Why a script instead of pg_dump: no Postgres client tools needed on Windows,
 * and it copies **data only** — the target keeps its own (correct) schema, so
 * the small pre/post-reset schema differences don't matter.
 *
 *   SOURCE_URL   the rescue branch (read-only as far as this script cares)
 *   TARGET_URL   the branch to restore into
 *
 * Usage (PowerShell, from the repo root):
 *
 *   pnpm add -D pg
 *   $env:SOURCE_URL="postgresql://...rescue-branch.../neondb?sslmode=require"
 *   $env:TARGET_URL="postgresql://...current-branch.../neondb?sslmode=require"
 *
 *   node scripts/restore-from-branch.mjs --dry-run   # report only, writes nothing
 *   node scripts/restore-from-branch.mjs             # actually copy
 *
 * Safety properties:
 *   · --dry-run writes nothing; run it first and read the table.
 *   · Every INSERT is ON CONFLICT DO NOTHING, so re-running is safe and will
 *     never overwrite or duplicate a row that already made it across.
 *   · Tables are copied parents-first (topological order on foreign keys), so
 *     nothing fails for a missing reference.
 *   · One transaction per table: a table either lands whole or not at all.
 *   · Nothing is ever deleted from either database.
 */

// Loaded dynamically so a missing dependency produces an instruction rather
// than a stack trace. In a pnpm workspace the root install needs -w.
let pg
try {
  pg = (await import('pg')).default
} catch {
  console.error(
    '\nMissing dependency "pg".\n\n' +
    'This repo is a pnpm workspace, so installing at the root needs -w:\n\n' +
    '    pnpm add -D -w pg\n\n' +
    'Then re-run this script.\n'
  )
  process.exit(1)
}

const { Client } = pg

// Trimmed because a stray space pasted inside the quotes is otherwise a
// baffling connection failure.
const SOURCE_URL = process.env.SOURCE_URL?.trim()
const TARGET_URL = process.env.TARGET_URL?.trim()
const DRY_RUN = process.argv.includes('--dry-run')
const BATCH = 500

if (!SOURCE_URL || !TARGET_URL) {
  console.error('Set both SOURCE_URL (rescue branch) and TARGET_URL (current branch).')
  process.exit(1)
}
if (SOURCE_URL === TARGET_URL) {
  console.error('SOURCE_URL and TARGET_URL are the same database. Refusing to run.')
  process.exit(1)
}

/** Tables that are Prisma/Postgres bookkeeping — never copy these. */
const SKIP = new Set(['_prisma_migrations'])

const connect = async (url) => {
  const insecure = /sslmode=disable/.test(url)
  const c = new Client({ connectionString: url, ssl: insecure ? false : { rejectUnauthorized: false } })
  await c.connect()
  return c
}

/** Column names + udt types for a table, in ordinal order. */
async function columnsOf(client, table) {
  const { rows } = await client.query(
    `SELECT column_name, udt_name
       FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position`,
    [table]
  )
  return rows.map((r) => ({ name: r.column_name, udt: r.udt_name }))
}

async function tablesOf(client) {
  const { rows } = await client.query(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`
  )
  return rows.map((r) => r.table_name).filter((t) => !SKIP.has(t))
}

/** table -> tables it references, so we can copy parents first. */
async function dependencyGraph(client) {
  const { rows } = await client.query(`
    SELECT tc.table_name AS child, ccu.table_name AS parent
      FROM information_schema.table_constraints tc
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
       AND ccu.table_schema = tc.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
  `)
  const deps = new Map()
  for (const { child, parent } of rows) {
    if (child === parent) continue // self-reference: order within the table is fine
    if (!deps.has(child)) deps.set(child, new Set())
    deps.get(child).add(parent)
  }
  return deps
}

/** Kahn's algorithm; anything left in a cycle is appended in stable order. */
function topoSort(tables, deps) {
  const out = []
  const done = new Set()
  let remaining = [...tables].sort()
  let progress = true
  while (remaining.length && progress) {
    progress = false
    const next = []
    for (const t of remaining) {
      const need = [...(deps.get(t) ?? [])].filter((p) => tables.includes(p))
      if (need.every((p) => done.has(p))) {
        out.push(t); done.add(t); progress = true
      } else {
        next.push(t)
      }
    }
    remaining = next
  }
  return [...out, ...remaining]
}

/** "user@host/db" — safe to print, password removed. */
function describe(url) {
  try {
    const u = new URL(url)
    return `${u.username}@${u.hostname}${u.pathname}`
  } catch {
    return '(unparseable URL)'
  }
}

async function main() {
  console.log(`\nSOURCE (read from):  ${describe(SOURCE_URL)}`)
  console.log(`TARGET (write to):   ${describe(TARGET_URL)}`)

  const src = await connect(SOURCE_URL)
  const dst = await connect(TARGET_URL)

  try {
    const srcTables = await tablesOf(src)
    const dstTables = await tablesOf(dst)
    const shared = srcTables.filter((t) => dstTables.includes(t))
    const ordered = topoSort(shared, await dependencyGraph(dst))

    const onlySource = srcTables.filter((t) => !dstTables.includes(t))
    if (onlySource.length) {
      console.log(`note: present in the rescue branch but not the target, skipping: ${onlySource.join(', ')}`)
    }

    console.log(`\n${DRY_RUN ? 'DRY RUN — nothing will be written' : 'RESTORING'}  (${ordered.length} tables)\n`)
    console.log('table'.padEnd(24), 'source'.padStart(8), 'target'.padStart(8), '  ', 'action')
    console.log('-'.repeat(64))

    let copiedTotal = 0
    const problems = []

    for (const table of ordered) {
      const q = `"${table}"`
      const [{ rows: [s] }, { rows: [d] }] = await Promise.all([
        src.query(`SELECT COUNT(*)::int AS n FROM ${q}`),
        dst.query(`SELECT COUNT(*)::int AS n FROM ${q}`),
      ])

      if (s.n === 0) {
        console.log(table.padEnd(24), String(s.n).padStart(8), String(d.n).padStart(8), '  ', 'empty in source — skip')
        continue
      }

      // Copy only the columns both sides actually have. This is what makes the
      // restore survive the schema drift between the two branches.
      const srcCols = await columnsOf(src, table)
      const dstCols = await columnsOf(dst, table)
      const dstByName = new Map(dstCols.map((c) => [c.name, c]))
      const cols = srcCols.filter((c) => dstByName.has(c.name))
      const dropped = srcCols.filter((c) => !dstByName.has(c.name)).map((c) => c.name)

      if (DRY_RUN) {
        console.log(
          table.padEnd(24), String(s.n).padStart(8), String(d.n).padStart(8),
          '  ', `would copy ${s.n} row(s)${dropped.length ? ` (ignoring column(s): ${dropped.join(', ')})` : ''}`
        )
        continue
      }

      const names = cols.map((c) => `"${c.name}"`).join(', ')
      // pgvector values come back as text; cast them back on the way in.
      const placeholders = (offset) =>
        cols.map((c, i) => (c.udt === 'vector' ? `$${offset + i + 1}::vector` : `$${offset + i + 1}`)).join(', ')

      let inserted = 0
      let skipped = 0
      try {
        await dst.query('BEGIN')
        for (let off = 0; off < s.n; off += BATCH) {
          const { rows } = await src.query(
            `SELECT ${names} FROM ${q} ORDER BY 1 LIMIT ${BATCH} OFFSET ${off}`
          )
          for (const row of rows) {
            const values = cols.map((c) => row[c.name])
            // rowCount is 0 when ON CONFLICT DO NOTHING skipped an existing
            // row, so this counts what actually landed rather than attempts.
            const res = await dst.query(
              `INSERT INTO ${q} (${names}) VALUES (${placeholders(0)}) ON CONFLICT DO NOTHING`,
              values
            )
            if (res.rowCount > 0) inserted++
            else skipped++
          }
        }
        await dst.query('COMMIT')
        copiedTotal += inserted
        const detail = [
          `inserted ${inserted}`,
          skipped ? `${skipped} already present` : null,
          dropped.length ? `ignored column(s): ${dropped.join(', ')}` : null,
        ].filter(Boolean).join(', ')
        console.log(
          table.padEnd(24), String(s.n).padStart(8), String(d.n).padStart(8), '  ', detail
        )
      } catch (err) {
        await dst.query('ROLLBACK').catch(() => {})
        problems.push({ table, message: err.message })
        console.log(table.padEnd(24), String(s.n).padStart(8), String(d.n).padStart(8), '  ', `FAILED — rolled back`)
      }
    }

    console.log('-'.repeat(64))
    if (DRY_RUN) {
      console.log('\nDry run complete. Nothing was written.')
      console.log('Re-run without --dry-run to perform the restore.')
    } else {
      console.log(`\nInserted ${copiedTotal} new row(s) in total.`)
      if (problems.length) {
        console.log(`\n${problems.length} table(s) failed and were rolled back individually:`)
        for (const p of problems) console.log(`  · ${p.table}: ${p.message}`)
        console.log('\nEverything else landed. Re-running is safe (ON CONFLICT DO NOTHING).')
      } else {
        console.log('No failures.')
      }
    }

    // The headline number, whatever else happened.
    const { rows: [n] } = await dst.query(`SELECT COUNT(*)::int AS n FROM "Note"`)
    console.log(`\nNotes now in the target database: ${n.n}`)
  } finally {
    await src.end().catch(() => {})
    await dst.end().catch(() => {})
  }
}

main().catch((err) => {
  console.error('\nRestore aborted:', err.message)
  process.exit(1)
})
