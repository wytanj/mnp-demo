# Brief: Multi-programme Review + empty card body fix (mnp-demo)

**Repo:** wytanj/mnp-demo  
**Branch:** `demo/tuesday-hygiene-musthaves` (this worktree — prefer `~/Desktop/Coding/mnp-demo-wt-demo`)  
**PR:** https://github.com/wytanj/mnp-demo/pull/1 (draft — keep draft)  
**Worktree:** stay in the CoS-prepared worktree; do **not** create another Claude `-w` worktree.

## ROLE SPLIT (required — do not weaken)
- You are Fable 5.1: ORCHESTRATOR only. Plan, interview the repo, write rubrics, spawn/babysit workers, cross-judge, graft, verify proofs, open draft PR.
- Do NOT implement the bulk of the code yourself.
- Worker model: Opus (latest opus / claude-opus). Spawn implementer subagents on Opus for all file writes.
- Prefer Task/subagent isolation. Prefer the CoS-prepared worktree — do not create another Claude `-w` worktree unless the brief says so.
- FORBIDDEN: spawning Fable (or non-Opus) as implementers; writing the bulk of the diff yourself.

## DONE WEBHOOK (required)
When finished, blocked, needs_felicia, or failed — POST once to $COS_CLAUDE_DONE_WEBHOOK_URL with Bearer + X-Automation-Key and JSON status/repo/pr_url/branch/summary/blocker/next_step.
Also open/update the draft PR. If webhook env missing: still open draft PR and say webhook was skipped.
Secrets live in `~/Desktop/Coding/.secrets/cos-claude-done-webhook.env` — never paste the key into chat.

## PRIORITY LOCK
**Review / reward automation is the demo must-have** — make this extensive but not redundant. Partners/billing polish is out of scope unless trivial. No real email/WhatsApp.

---

## Bug fix A — empty card bodies on `/ops/rewards`

Felicia screenshot showed **Programme rules**, **Reward codes issued** (badge 2), and **Pending claim** (badge 1) as **header-only with no body visible**, while outbox / pending asks / held showed content.

Code in `app/pages/ops/rewards.vue` already has `UCard` bodies with RULES bullets / issued table / awaiting list — they are **NOT** meant to be collapsed empty.

**Fix:** make card bodies always render visibly (Nuxt UI `UCard` slot/CSS issue, or accidental collapse).

**Prove:** eyeball or assert DOM has rule bullets + issued rows after seed (e.g. soft-reload `/ops/rewards` post-reseed).

---

## Feature B — multiple review programmes + effectiveness

### Today
One hardcoded Grab $10 loop + static global `RULES` on `/ops/rewards`.

### Add demo-friendly multi-programme support

Seed **2–3 programmes**, e.g.:

1. **"5★ auto Grab $10"** — immediate voucher on 5★  
2. **"Public review screenshot"** — Google/Facebook proof → CS verify → voucher  
3. **"B2B delayed ask"** — ask N days after delivery; different reward or no auto-voucher  

Requirements:

- Jobs / reviews attributed to a `programmeId`
- `/ops/rewards`: programme **switcher or tabs** + **comparison strip** showing effectiveness per programme:
  - asks sent
  - reviews received
  - ask→review %
  - avg rating
  - vouchers issued
  - cost per review *(demo numbers OK)*
- Programme rules card becomes **per-selected-programme** (not one global list)
- Keep existing flows working: pending asks, held, outbox, MCP reward tools
- Extend seed in `server/utils/store.ts` + reseed path
- Nuxt UI components; demo polish; **no real backend**
- How-to `USlideover` optional one-liner if easy

---

## Out of scope
- Partners / billing polish unless trivial
- Real email / WhatsApp

---

## Proof / acceptance
- `nuxt build` green
- Key `/ops/rewards` routes return 200
- After reseed, multi-programme UI shows **distinct** effectiveness numbers per programme
- Card bodies visible (rules bullets + issued rows in DOM)
- Push commits to **same branch** `demo/tuesday-hygiene-musthaves`
- Update PR #1 comment with what changed / how to demo
- DONE WEBHOOK POST
- **Draft stays draft** — do not mark ready for review

---

## Done checklist
1. Bug A fixed + Feature B shipped in this worktree  
2. Push to `demo/tuesday-hygiene-musthaves`  
3. Comment on https://github.com/wytanj/mnp-demo/pull/1  
4. DONE WEBHOOK once  
5. Leave PR #1 as draft  
