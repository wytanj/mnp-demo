# Brief: M&P Tuesday demo — Nuxt UI shell (max surfaces, seeded, agent-ready)

**Owner (Felicia 2026-09-13):** Pitch-mode UI redo. Maximize click-through surfaces for a live demo. Light/no real backend integrations. Seeded data must support Grok Bot / Claude via MCP in the room. Brand: charcoal `#221F1F` + orange `#F17421`.

## ROLE SPLIT (required — do not weaken)
- You are Fable 5.1: ORCHESTRATOR only. Plan, interview the repo, spawn Opus workers, graft, verify, push, update draft PR.
- Do NOT implement the bulk yourself. Worker model: Opus.
- Prefer THIS CoS worktree (`mnp-demo-wt-demo`). No new Claude `-w` worktree.
- FORBIDDEN: Fable as implementer; bulk diff yourself.

## DONE WEBHOOK (required)
POST once when finished/blocked/failed to `$COS_CLAUDE_DONE_WEBHOOK_URL` with Bearer + X-Automation-Key. Update draft PR #1 (or open a new draft if cleaner). Include run notes for Felicia (reseed, demo path).

## Product lock

### Door page `/`
Three large buttons only:
1. **Internal ops**
2. **Client portal**
3. **Driver**

No kitchen-sink on `/` (no rewards essay, no MCP paste card, no rollout plan, no SOA gallery).

### Internal ops — left sidebar (Nuxt UI dashboard pattern)
Click-through pages, seeded:
- **Jobs** — list + job detail (status, docs, copy tracking link)
- **Inbox / Comms** — unified email + WhatsApp threads tied to jobs (staff pain: lots of email/WA)
- **Customs queue** — declarations waiting / missing fields; open a declaration form that looks fillable (must-have)
- **Reviews** — asked / received / suppressed (must-have)
- **Quotes** — rate cards + auto-quote request feel
- **Partners** — coordination board (shipping line / warehouse / broker / agent status per job)
- **Exceptions** — alerts / stuck jobs
- **Agent desk** — demo prompts + MCP status; “ask about MP-4471” copy for live Grok/Claude
- Optional light: Docs vault, Billing/SOA (one seeded statement), not home chrome

### Client portal
- My shipments · Track · Request quote (auto-quotation UI) · POD / review

### Driver
- Phone-first: today’s jobs → note/photo → delivered (keep existing behavior if present)

### Agent / MCP (required for live demo)
- Keep/extend existing `/mcp` tools so Claude or Grok Bot can list shipments, full status, outstanding actions, customs gaps, open comms.
- **Seed must be rich and stable**: hero jobs with incomplete customs, open WA/email threads, partner waits, review-pending — so spoken demo questions work without typing fake data live.
- Document 3–5 demo prompts in README + Agent desk page.
- Reseed script path remains `scripts/reseed.mjs` (do not run prod reseed unless brief says; leave note for Felicia).

## Tech
- Add `@nuxt/ui` (and Tailwind as required by Nuxt UI). Prefer Nuxt UI dashboard / sidebar / cards / tables / badges.
- Reuse existing Nitro APIs / seed / track / driver / review / customs where they exist; wrap with new layouts rather than rewriting all logic.
- Pitch-mode: simulated WhatsApp + email is fine (no real Twilio/Gmail). Customs form can be client-side fill from seed + “Submit to TradeNet (demo)” toast.
- `npm run build` green. Local ci only — do not burn Actions minutes.

## Out of scope
- Real WhatsApp/Twilio/Gmail/TradeNet integrations
- WordPress/Payload rewrite
- Prod reseed (note only)
- Pressly / other repos

## Acceptance
- `/` is three doors only
- Internal ops has left sidebar with the pages above
- Seeded data supports MCP demo questions for Grok/Claude
- Comms (email+WA), customs key-in, partner coord, reviews visible
- README has Tuesday live-demo path (doors → ops job → customs → review → Agent desk / MCP)
- Draft PR updated; webhook fired
