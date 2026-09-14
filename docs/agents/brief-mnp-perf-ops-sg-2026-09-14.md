# Brief: Ops load perf — pin sin1 + slim jobs feed (mnp-demo)

**Repo:** wytanj/mnp-demo  
**Branch:** `perf/ops-sg-slim-feed` (this worktree)  
**Worktree:** stay in the CoS-prepared worktree; do **not** create another Claude `-w` worktree.  
**Vercel project:** `variants/mnp-flow` → https://mnp-flow.vercel.app  
**Product owner:** Felicia already set Functions region to **Singapore** in the Vercel UI. Pin it in-repo so deploys cannot drift back to `iad1`.

## ROLE SPLIT (required — do not weaken)
- You are Fable 5.1: ORCHESTRATOR only. Plan, interview the repo, write rubrics, spawn/babysit workers, cross-judge, graft, verify proofs, open/update draft PR.
- Do NOT implement the bulk of the code yourself.
- Worker model: Opus (latest opus / claude-opus). Spawn implementer subagents on Opus for all file writes.
- Prefer Task/subagent isolation. Prefer the CoS-prepared worktree — do not create another Claude `-w` worktree unless the brief says so.
- FORBIDDEN: spawning Fable (or non-Opus) as implementers; writing the bulk of the diff yourself.

## DONE WEBHOOK (required)
When finished, blocked, needs_felicia, or failed — POST once to $COS_CLAUDE_DONE_WEBHOOK_URL with Bearer + X-Automation-Key and JSON status/repo/pr_url/branch/summary/blocker/next_step.
Also open/update the draft PR. If webhook env missing: still open draft PR and say webhook was skipped.
Secrets live in `~/Desktop/Coding/.secrets/cos-claude-done-webhook.env` — never paste the key into chat.

## Why (measured 2026-09-14)
Before region change, production lambdas were **`iad1`**. From SG:
- `/` ~0.3–0.6s
- `/ops/jobs` ~3–4s every request, ~185KB HTML, ~53KB `__NUXT_DATA__` (full shipment objects)
- `/api/shipments` alone ~1.8s
Root causes beyond region: SSR `await useFetch('/api/shipments')` + `/api/comms` on jobs list embeds **full** shipments (events timelines etc.); `ensureSeeded()` does an extra Supabase 1-row round-trip on every `dbGet*` before serving; 5s client poll refreshes full payloads.

## Goals (ship all)

### A — Pin Singapore in repo
- Add Vercel/Nitro region **`sin1`** (e.g. `vercel.json` `regions: ["sin1"]` and/or `nitro.vercel.regions` / documented Nuxt equivalent). Match what Felicia set in the dashboard.
- Prove in PR notes how to confirm next deploy lands in `sin1` (`vercel inspect` shows region).

### B — Slim list feed for `/ops/jobs`
- Jobs list must **not** SSR the full fat `Shipment[]` with complete event histories.
- Preferred shape:
  - List endpoint returns **summary rows** (id, status, customer, eta, mode, flags needed for attention tiles / table columns, short partner/customs/claim/review signals) — enough for `app/pages/ops/jobs/index.vue` attention model + table.
  - Detail page `app/pages/ops/jobs/[id].vue` keeps full `/api/shipments/:id`.
- Options (pick smallest that works; Prefer Subtract):
  1. New `GET /api/shipments?view=summary` (or `/api/ops/jobs`) used by the list page; keep existing full `GET /api/shipments` for callers that need it, **or**
  2. Strip heavy fields server-side for the list consumer only.
- Update `app/pages/ops/jobs/index.vue` to use the slim feed. Keep 5s poll **but** poll the slim endpoint only (or lengthen interval if still chatty — default keep 5s if slim).
- Do not break: create-job POST, attention tiles, filters, navigation to detail.

### C — Hot-path seed check
- `server/utils/db.ts` `ensureSeeded()` currently runs a Supabase `limit=1` on **every** read.
- Cache “already seeded” for the life of the isolate (module/global flag) so warm invocations skip the extra round-trip. Still reseed if empty after a wipe (keep the wipe→reseed behavior, just don’t pay for it every request once known non-empty).
- Memory fallback path unchanged.

### D — Optional (only if cheap)
- Lazy / `server: false` for list fetches if SSR of the slim list is still >~1.5s after A–C — only if measured. Prefer keeping SSR if slim+sin1 is enough.
- Do **not** redesign the ops UI.

## Out of scope
- Real email/WhatsApp
- Changing demo narrative / seed content (except fields needed for summary)
- Rewards / customs feature work
- Moving Supabase region (assume OK; if SG functions + distant DB dominates, note it in PR, don’t migrate DB in this ticket)

## Proof / acceptance
1. `nuxt build` green (or project’s usual build).
2. Before/after from Mac or curl against preview OR local: `/ops/jobs` HTML or Nuxt payload clearly smaller (report KB); list JSON much smaller than full shipments dump.
3. Attention tiles + jobs table still work with seed data; open a job detail still shows full timeline.
4. Region pinned in repo; PR body says Felicia already set dashboard SG + code pin.
5. Draft PR opened/updated on `perf/ops-sg-slim-feed`; webhook fired.

## Report
PR URL + measured before/after sizes/timings in the PR body.
