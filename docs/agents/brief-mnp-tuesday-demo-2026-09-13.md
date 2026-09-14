# Brief: M&P Tuesday live demo — hygiene UI/UX + must-haves (mnp-demo)

**Live:** https://mnp-flow.vercel.app  
**Repo:** wytanj/mnp-demo (Felicia has WRITE). Extend this app — do not fork a second Vercel.

## ROLE SPLIT (required — do not weaken)
- You are Fable 5.1: ORCHESTRATOR only. Plan, interview the repo, write rubrics, spawn/babysit workers, cross-judge, graft, verify proofs, open/update draft PR.
- Do NOT implement the bulk of the code yourself.
- Worker model: Opus (latest opus / claude-opus). Spawn implementer subagents on Opus for all file writes.
- Prefer Task/subagent isolation. Prefer the CoS-prepared worktree — do not create another Claude `-w` worktree unless the brief says so.
- FORBIDDEN: spawning Fable (or non-Opus) as implementers; writing the bulk of the diff yourself.

## DONE WEBHOOK (required)
When finished, blocked, needs_felicia, or failed — POST once to $COS_CLAUDE_DONE_WEBHOOK_URL with Bearer + X-Automation-Key and JSON status/repo/pr_url/branch/summary/blocker/next_step.
Also open/update the draft PR. If webhook env missing: still open draft PR and say webhook was skipped.

## Product locks (Felicia)
1. Build on this app / mnp-flow — extend, don’t fork.
2. Public self-serve on same deploy — polish `/track/…` (status, docs, ask-about-shipment).
3. **Drop Freshdesk** for the demo path — job-tied inbox is the story; no Gravity Forms→Freshdesk hero.
4. TradeNet = **human-in-loop only** — never auto-file / never claim auto TradeNet.
5. Don’t invent Google review counts/ratings in UI copy.

## Ship order

### A — UI/UX review + hygiene improve (not a full redesign)
Review ops home, mail log, rewards, `/track`, and improve where demo clarity suffers:

- Ops: **jobs primary**; mail/rewards/MCP secondary (mail currently dominates right column).
- Mail log: filter/seed so PickleSprout/tournament/spam doesn’t drown freight threads; keep job-tied mail story.
- Sender: mask/fix `tracking@pickletour.app` → M&P-looking from-address for the room.
- Pre-pick / highlight 2–3 hero jobs for the script: customs Docs X/Y (e.g. MP-4471-AF), delivered→review, clean `/track`.
- `/track`: fix stale ETA vs timeline contradiction; improve progress label contrast; docs not buried; stronger “ask about shipment” affordance; keep uploads (payment slip/photos). Do **not** expose full CS mail thread on customer track.
- Rewards module is relatively clear — light polish only if needed.
- Empty/mobile pass where cheap.

### B — Must-haves on same app
1. **Customs declaration intake** — doc checklist on import+customs jobs (commercial invoice, packing list, B/L or AWB, permits); status Docs X/Y; intake/check only; TradeNet human-approved.
2. **Review automation** — ask after successful delivery (and customs clear when relevant); **suppress** auto-ask if open claim (damage / missing / destination fee / no-reply) → route CS/claims; optional “who helped you?” for named-staff praise; rewards verify path (Google/FB proof → Grab voucher).

### C — Self-serve beat
Polish `/track/…` so the live demo can show customer self-serve on the same job after the Freshdesk-kill beat.

## Out of scope
- Full TMS rewrite, real TradeNet submit, WordPress/Payload migration, Taobao consolidate depth (mention only if time).
- Pressly / Hearing Partners work.

## Acceptance
- Draft PR against wytanj/mnp-demo
- Ops layout jobs-primary; mail hygiene; M&P from-address; hero jobs usable
- `/track` clearer (ETA/timeline, progress, docs, ask)
- Customs intake + review ask/suppress + rewards path demoable
- Local `npm run build` or project’s usual check green
- Short note in PR body: run-of-show beats this unlocks
