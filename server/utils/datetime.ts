/**
 * Human-readable timestamps for strings people (and the AI assistant) read out
 * loud. Everything is pinned to Singapore time so server, browser and the MCP
 * transcript all agree. Machine fields (`eta`, `since`, `at`, `openedAt`, …)
 * stay ISO — only prose gets formatted.
 */
export const SG_TZ = 'Asia/Singapore'

function dayKey(value: string | number | Date): string {
  return new Date(value).toLocaleDateString('en-CA', { timeZone: SG_TZ })
}

/** "3:17 pm" */
export function fmtSgTime(iso: string | number | Date): string {
  return new Date(iso).toLocaleTimeString('en-SG', {
    timeZone: SG_TZ, hour: 'numeric', minute: '2-digit'
  })
}

/** "13 Sept" */
export function fmtSgDate(iso: string | number | Date): string {
  return new Date(iso).toLocaleDateString('en-SG', {
    timeZone: SG_TZ, day: 'numeric', month: 'short'
  })
}

/** "Today, 3:17 pm" · "Yesterday, 9:05 am" · "13 Sept, 3:17 pm" */
export function fmtSgWhen(iso: string | number | Date): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  const time = fmtSgTime(d)
  const key = dayKey(d)
  if (key === dayKey(Date.now())) return `today at ${time}`
  if (key === dayKey(Date.now() + 86_400_000)) return `tomorrow at ${time}`
  if (key === dayKey(Date.now() - 86_400_000)) return `yesterday at ${time}`
  return `${fmtSgDate(d)}, ${time}`
}

/** "6h ago" · "in 3h" · "just now" · "2 days ago" */
export function fmtAgo(iso: string | number | Date): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return String(iso)
  const diff = Date.now() - t
  const abs = Math.abs(diff)
  const mins = Math.round(abs / 60_000)
  let span: string
  if (mins < 2) return 'just now'
  if (mins < 60) span = `${mins} min`
  else if (abs < 48 * 3600_000) span = `${Math.round(abs / 3600_000)}h`
  else span = `${Math.round(abs / 86_400_000)} days`
  return diff >= 0 ? `${span} ago` : `in ${span}`
}

/** "13 Sept, 3:17 pm (6h ago)" — the shape used in exception prose. */
export function fmtSgWhenAgo(iso: string | number | Date): string {
  return `${fmtSgWhen(iso)} (${fmtAgo(iso)})`
}
