# Brief: M&P written proposal slides on Vercel (read-alone)

**Repo:** wytanj/mnp-demo (live: https://mnp-flow.vercel.app)
**Worktree:** stay in this checkout — do not create another Claude `-w` worktree.
**Branch:** `feat/proposal-slides`
**Audience:** M&P decision-makers — **not tech-savvy**, slow with tech flows. This deck is **emailed / sent as a proposal** (no presenter). Every slide must be self-explanatory with enough plain sentences that a careful non-technical reader understands without a speaker.

## ROLE SPLIT (required — do not weaken)
- You are Fable 5.1: ORCHESTRATOR only. Plan, interview the repo, write rubrics, spawn/babysit workers, cross-judge, graft, verify proofs, open/update draft PR.
- Do NOT implement the bulk of the code yourself.
- Worker model: Opus (latest opus / claude-opus). Spawn implementer subagents on Opus for all file writes.
- Prefer Task/subagent isolation. Prefer this CoS-prepared worktree.
- FORBIDDEN: spawning Fable (or non-Opus) as implementers; writing the bulk of the diff yourself.

## DONE WEBHOOK (required)
When finished, blocked, needs_felicia, or failed — POST once to `$COS_CLAUDE_DONE_WEBHOOK_URL` with Bearer + X-Automation-Key and JSON `status` / `repo` / `pr_url` / `branch` / `summary` / `blocker` / `next_step`.
Also open/update the draft PR. If webhook env missing: still update draft PR and say webhook was skipped.

## Product locks (Felicia 2026-09-16)
1. **Written proposal, not a talk.** Detailed body copy on each slide. Short paragraphs OK; bullet lists OK; avoid walls of jargon.
2. **Do NOT name Freshdesk** (or any specific current tool) unless you find it already labeled in this repo as customer-facing copy. Their current software is **unconfirmed**. Say “your current system” / “the software you use today.”
3. Keen themes to emphasise: **reviews & rewards**, **jobs**, **WhatsApp + email consolidated under each job**.
4. Transition concern: they worry about **typing into two systems**. They want to **trial with a few customers first**, and those customers’ info must **still exist in the existing system**.
5. Sync story (approved framing): trial team works day-to-day in the new app for those few customers; a **daily helper** can copy important updates into the current system so they are not double-typing — **only after** we look at what their current system can connect (API / export / manual). Do not promise a finished sync product in this PR; promise the **approach** and the **next discovery step**.
6. Never use: API, bidirectional, system of record, webhook, MCP, DBOS, etc. Prefer: connect, copy across overnight / daily, official file, helper.

## Deliverable
Add a **proposal deck route** on the same Nuxt app (prefer `/proposal` or `/slides` — pick one, document in PR). It should look like a clean slide deck suitable to send as a link (full-viewport slides, next/prev, keyboard arrows, mobile readable). Match existing mnp-flow visual language where practical (logo/assets already in repo).

### Slide content (use this outline; expand each into full read-alone copy)

**Slide 1 — Title**
Title: something like “M&P Flow — a simpler way to run jobs, reviews, and customer messages”
Subtitle: A short trial with a few customers first
One line that this document is a proposal they can read at their own pace.

**Slide 2 — What is hard today**
Jobs, WhatsApp, email, and reviews often live in different places.
Easy to miss a message or a review.
Updating the same job in more than one place means extra typing and mistakes.
(Keep gentle; do not insult their current tools.)

**Slide 3 — What we are proposing**
One place for each job.
Under that job: WhatsApp and email together.
Reviews and rewards tied to the same job.
A clear trial plan so you do not have to switch everything at once.

**Slide 4 — Reviews & rewards (detail)**
Happy path: after a job, ask for a review; good outcomes can lead to a reward.
Unhappy path: catch problems as a claim / follow-up — not pushed as a public review.
Staff can see who was asked, who replied, and who received a reward.
Explain why this matters for reputation and staff time, in plain words.

**Slide 5 — Jobs at the centre (detail)**
Every shipment / engagement is one job card.
Status, documents, and messages sit on that card.
Less hunting across inboxes for “which job was this about?”

**Slide 6 — WhatsApp + email under the job (detail)**
One list of conversations for that job.
Staff reply from the job screen.
Reduces lost messages and handoff confusion.

**Slide 7 — Your concern: two systems**
We heard you: pilot customers must still appear in your current software.
You do not want to type the same facts twice every day.
The trial is designed around that worry — not around forcing a sudden cutover.

**Slide 8 — How the trial works**
1. Choose a small number of customers for the trial.
2. For those customers’ jobs, your trial team works day-to-day in M&P Flow (jobs, messages, reviews/rewards).
3. Those customers’ important records still show up in your current system.
4. A daily helper can copy the important updates across (once we confirm what your current system allows).
5. Everyone else keeps working exactly as they do today.

**Slide 9 — What we do before promising daily copy**
We sit with you and look at the software you use today.
We check what can be connected automatically, what can be exported, and what would stay as a simple checklist for now.
We only automate the daily copy where it is clear and safe.
No surprise “big bang” switch.

**Slide 10 — What stays familiar**
Your existing tools keep running for the rest of the company.
We are not asking you to throw away everything on day one.
This is a small lane for a few customers, then you decide.

**Slide 11 — What you can try in the live demo (optional companion)**
Link to https://mnp-flow.vercel.app with 3–4 short “open this page and look for…” steps for jobs, messages under a job, reviews/rewards. Written so someone can click alone.

**Slide 12 — What we are asking**
Agree a short list of trial customers.
Agree which facts must stay visible in the current system during the trial.
Book a short session to look at that system’s connect / export options.
Start the trial when that list is clear.

## Implementation notes
- Content can live as markdown / structured data driving the slides (easy to edit later).
- Prefer accessibility: large readable type, high contrast, not tiny captions.
- Include a simple progress indicator (e.g. “3 / 12”).
- No fake claims about integrations already live with their unknown current system.
- Screenshots: reuse existing demo screenshots/assets in repo if helpful; do not invent client logos or fake “synced with X” badges.
- Keep scope to the proposal deck + light nav link from home/doors if it fits without cluttering the live demo pitch.

## Proofs before draft PR ready for Felicia
- `npm run build` (or project’s usual build) passes in this worktree.
- Manual: open `/proposal` (or chosen path) locally, step through all slides with keyboard + buttons; copy reads as a standalone proposal.
- PR body: preview notes, route URL on Vercel after deploy, content locks above, and explicit “Freshdesk not named.”
- Update draft PR description; fire DONE WEBHOOK.

## Out of scope
- Building the real daily sync bot / connectors to their unknown current system.
- Changing core ops/jobs/review product behaviour beyond what’s needed to deep-link or screenshot.
- Assuming Freshdesk or any named legacy tool.
