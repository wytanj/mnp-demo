/**
 * One-shot Supabase reseed helper — DESTRUCTIVE, run manually only.
 *
 * Deletes every row in the `emails` and `shipments` tables so the next request
 * to the app hits `ensureSeeded()` in server/utils/db.ts and re-inserts the
 * current seed from server/utils/store.ts (buildSeedData).
 *
 * Local dev needs none of this: without SUPABASE_URL the app runs fully in
 * memory and reseeds on every restart of `npm run dev`.
 *
 * Usage (only when you actually want to wipe the demo database):
 *   node --env-file=.env scripts/reseed.mjs --yes
 *
 * Requires SUPABASE_URL and SUPABASE_ANON_KEY in the environment.
 * Anything a demo user did on the deployed app (uploads, sign-offs, claims,
 * customs marks, reviews) is lost. There is no undo.
 */

const url = process.env.SUPABASE_URL
const key = process.env.SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY must be set (try: node --env-file=.env scripts/reseed.mjs --yes)')
  process.exit(1)
}

if (!process.argv.includes('--yes')) {
  console.error('Refusing to wipe the demo database without --yes.')
  console.error('This deletes ALL rows in `emails` and `shipments`; the app reseeds on the next request.')
  console.error('Run: node --env-file=.env scripts/reseed.mjs --yes')
  process.exit(1)
}

const headers = {
  apikey: key,
  authorization: `Bearer ${key}`,
  'content-type': 'application/json',
  prefer: 'count=exact'
}

async function wipe(table) {
  // PostgREST requires a filter — `id=not.is.null` matches every row.
  const res = await fetch(`${url}/rest/v1/${table}?id=not.is.null`, { method: 'DELETE', headers })
  if (!res.ok) {
    throw new Error(`DELETE ${table} failed: ${res.status} ${await res.text()}`)
  }
  console.log(`cleared ${table} (${res.headers.get('content-range') ?? 'ok'})`)
}

await wipe('emails')
await wipe('shipments')
console.log('done — open the app once and ensureSeeded() will insert the current seed.')
