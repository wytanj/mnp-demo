import postgres from 'postgres'

const sql = postgres(process.env.SUPABASE_POOLER, { ssl: 'require' })

await sql`create table if not exists shipments (id text primary key, data jsonb not null)`
await sql`create table if not exists emails (id text primary key, at timestamptz not null default now(), data jsonb not null)`

const [{ count }] = await sql`select count(*)::int as count from shipments`
console.log('tables ready, shipments rows:', count)
await sql.end()
