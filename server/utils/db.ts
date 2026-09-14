import type { OutboxEmail, Shipment } from '#shared/utils/shipping'

// Supabase-backed persistence (REST + anon key). Falls back to in-memory
// per-instance storage when SUPABASE_URL / SUPABASE_ANON_KEY are absent.

interface MemStore { shipments: Map<string, Shipment>; emails: OutboxEmail[] }
const g = globalThis as unknown as {
  __memStore?: MemStore
  __seedKnown?: boolean
  __seedPromise?: Promise<void>
}

function supaCfg(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_ANON_KEY
  return url && key ? { url, key } : null
}

async function supa<T>(path: string, opts: { method?: string; body?: unknown; prefer?: string } = {}): Promise<T> {
  const cfg = supaCfg()!
  const res = await fetch(`${cfg.url}/rest/v1/${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      apikey: cfg.key,
      authorization: `Bearer ${cfg.key}`,
      'content-type': 'application/json',
      ...(opts.prefer ? { prefer: opts.prefer } : {})
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body)
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

function mem(): MemStore {
  if (!g.__memStore) {
    g.__memStore = { shipments: new Map(), emails: [] }
    const seed = buildSeedData()
    for (const s of seed.shipments) g.__memStore.shipments.set(s.id, s)
    g.__memStore.emails = seed.emails
  }
  return g.__memStore
}

// The 1-row probe used to run on every read — ~1 extra Supabase round-trip per
// request from sin1. Now it runs once per isolate: `g.__seedKnown` latches as
// soon as a non-empty table is seen (or we have just seeded it) and every later
// read skips the probe. A manual table wipe is still picked up, because
// dbGetShipments() clears the latch when its select comes back empty and
// reseeds — see there. Readers of a single row / of emails deliberately do not
// self-heal: a 404 must not cost a probe. Concurrent cold reads (the jobs feed
// Promise.all's shipments + emails) share one in-flight probe via
// `g.__seedPromise`, so a cold isolate seeds once, not once per reader.
async function seedProbe(): Promise<void> {
  const rows = await supa<{ id: string }[]>('shipments?select=id&limit=1')
  if (!rows.length) {
    const seed = buildSeedData()
    await supa('shipments', {
      method: 'POST',
      prefer: 'resolution=merge-duplicates',
      body: seed.shipments.map((s) => ({ id: s.id, data: s }))
    })
    if (seed.emails.length) {
      await supa('emails', {
        method: 'POST',
        prefer: 'resolution=merge-duplicates',
        body: seed.emails.map((e) => ({ id: e.id, at: e.at, data: e }))
      })
    }
  }
  g.__seedKnown = true
}

async function ensureSeeded(): Promise<void> {
  if (g.__seedKnown) return
  // A rejected probe clears the slot in the finally, so the next read retries.
  g.__seedPromise ??= seedProbe().finally(() => {
    g.__seedPromise = undefined
  })
  await g.__seedPromise
}

export async function dbGetShipments(): Promise<Shipment[]> {
  if (!supaCfg()) return [...mem().shipments.values()]
  await ensureSeeded()
  let rows = await supa<{ data: Shipment }[]>('shipments?select=data')
  if (!rows.length) {
    // Table was wiped under a warm isolate — drop the latch, reseed, re-query once.
    g.__seedKnown = false
    await ensureSeeded()
    rows = await supa<{ data: Shipment }[]>('shipments?select=data')
  }
  return rows.map((r) => r.data)
}

export async function dbGetShipment(id: string): Promise<Shipment | undefined> {
  if (!supaCfg()) return mem().shipments.get(id)
  await ensureSeeded()
  const rows = await supa<{ data: Shipment }[]>(`shipments?select=data&id=eq.${encodeURIComponent(id)}`)
  return rows[0]?.data
}

export async function dbSaveShipment(s: Shipment): Promise<void> {
  if (!supaCfg()) {
    mem().shipments.set(s.id, s)
    return
  }
  await ensureSeeded()
  await supa('shipments', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: [{ id: s.id, data: s }]
  })
}

export async function dbListEmails(): Promise<OutboxEmail[]> {
  if (!supaCfg()) return mem().emails
  await ensureSeeded()
  const rows = await supa<{ data: OutboxEmail }[]>('emails?select=data&order=at.desc')
  return rows.map((r) => r.data)
}

export async function dbSaveEmail(e: OutboxEmail): Promise<void> {
  if (!supaCfg()) {
    mem().emails.unshift(e)
    return
  }
  await ensureSeeded()
  await supa('emails', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates',
    body: [{ id: e.id, at: e.at, data: e }]
  })
}
