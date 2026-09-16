# Brief: M&P proposal deck, rework as a visual walkthrough of the demo

**Repo:** wytanj/mnp-demo (live: https://mnp-flow.vercel.app). **Worktree:** this checkout, `/Users/feliciawu/Desktop/Coding/mnp-demo-wt-proposal-visual`. **Branch:** `feat/proposal-deck-visual`, from `main` at 93f8883 (PR #3 merged). **Supersedes** the copy-heavy version of `/proposal` from `docs/agents/brief-mnp-proposal-slides.md`; that brief's locks still hold.

## What Felicia said (2026-09-16, after seeing PR #3 live)

> the slides should not be all words and it should not be so literal to the client. it should be more of a presentation slides working through the details of the demo (just take it that the person in charge won't have time to see the demo). the idea is to show the current text through presentation, not literally write the text in the slides.

Read that as: keep the same messages (reviews and rewards, jobs, WhatsApp and email under each job, the two-systems worry, a small trial, daily copy-across only after we look at their real system), but carry them with **pictures of the demo** and short captions, the way a presenter would walk someone through the screens. The reader has no time for the live demo, so the deck *is* the demo tour.

## Locks (unchanged from PR #3)

- Never name the customer's current software or any tool. "Your current system", "the software you use today".
- Banned vocabulary stays banned (`scripts/check-proposal-copy.mjs`): API, bidirectional, system of record, webhook, MCP, DBOS, integration, sync, database, endpoint, automation. Extend the lint so it covers every string the new deck renders (captions, diagram labels, alt text), then arm it once (inject a banned word, watch it exit 1, restore) and quote the failing line in the PR.
- The daily copy-across is an approach plus a discovery session, never a finished product or an existing connection.
- Made-up customers and data are called out once, on the title slide.
- Route stays `/proposal`, `?slide=<id>` deep links, Back/Next, arrow, Page, Space, Home, End keys, "N / total" counter, progress bar, phone-readable. The doors link on `/` stays.

## The deck (adjust order or count only with a reason in the PR)

Each slide: a headline of at most ten words, ONE big picture or diagram, and at most three numbered captions of at most 25 words each. No paragraphs. Under 60 words of body text per slide.

1. **Title** (dark). "M&P Flow: what the demo shows." Sub: a short trial with a few customers first. One line: the pictures are from a demo with made-up customers.
2. **Today.** A simple diagram, not a screenshot: WhatsApp, email and paper notes as three separate places, one shipment in the middle that nobody can see whole.
3. **Three doors.** Screenshot of `/`. Captions: internal ops, client portal, driver.
4. **Every shipment is one job.** Screenshot of `/ops/jobs`. Captions: the strip counts what needs a person; one row per shipment; open one.
5. **The job card.** Screenshot of `/ops/jobs/MP-3318-MC`. Captions: status and timeline; documents received and missing; partners and messages on the same card.
6. **WhatsApp and email under the job.** Screenshot of `/ops/inbox` with Brendan's WhatsApp needing a reply. Captions: one list, both channels; reply from here; the reply lands on the job.
7. **Reviews.** Screenshot of `/ops/reviews`. Captions: asked, received, held; MP-8125-HF held because a claim is open; nobody asks the wrong customer.
8. **Rewards.** Screenshot of `/ops/rewards`. Captions: a good review can earn a small thank-you; staff see who received one.
9. **Your concern: two systems.** Diagram: a few trial customers inside M&P Flow, your current system as a plain grey box beside it, an arrow labelled "copied across daily, once we have looked at your system"; everyone else unchanged.
10. **How the trial works.** Five short steps drawn as a strip, not a list of sentences.
11. **Before we promise a daily copy.** Diagram of the discovery session: connect directly / send an official file daily / keep as a checklist for now.
12. **Try it yourself, if you have ten minutes.** Link to https://mnp-flow.vercel.app plus three "open this, look for that" lines.
13. **What we are asking.** Four short asks.

## How the pictures are made

- Screenshots come from the demo itself, never hand-drawn mockups of it. Write `scripts/capture-proposal-shots.mjs`: build (`npx nuxt build`), serve on port 3200 (`PORT=3200 node .output/server/index.mjs`, in-memory seed, no env needed), capture each route at 1440×900 with `playwright-core` on the installed Chrome (`channel: 'chrome'`, no browser download), save PNGs under `public/proposal/`. Commit the PNGs and the script. A reviewer reruns the script to regenerate them.
- Callout markers: numbered badges drawn over the picture at percentage positions from slide data (`marks: [{ n, x, y }]`), matching the numbered captions beside or under it. On phones the picture goes full width and the captions sit below.
- Diagrams are inline SVG or CSS boxes in the brand colours (charcoal `#221F1F`, orange `#F17421`, existing `mp-logo.svg`). No invented logos, no "synced with X" badges.
- Slide data stays in `app/utils/proposal.ts`; replace the paragraph-heavy block kinds with the kinds the deck now needs (picture, captions, diagram, steps strip, asks, link). Keep the file the only place copy is edited.

## Rules for this lane

- Never `cd`. Use `git -C <abs>`, `npm --prefix <abs>` or `npx --prefix`. Never `grep -r`, `rg` or `git grep`. Never read or print any `.env*` file. Port 3000 belongs to another worktree; use 3200 for yours. Do not create another worktree.
- `npm install` first (worktrees have no `node_modules`). `nuxt typecheck` cannot run here (no tsconfig); prove with `npx nuxt build` exit code and curl sweeps.
- Explicit `git add <paths>`; `git show --stat` before push. Commit trailer and PR footer exactly as below.
- Do not merge. Open a **draft** PR on wytanj/mnp-demo against `main`.
- The CoS bot is down: do NOT fire the done webhook. Say so in the last line of the PR body.

## Proofs before the PR is ready

- `npx nuxt build` exits 0. Curl every `/proposal?slide=<id>` returns 200 with no SSR error marker.
- `node scripts/check-proposal-copy.mjs` clean, and the armed failure quoted.
- Playwright screenshots of slides 1, 5 and 9 at 1440 and 525 wide, saved to `.local/proof/` (gitignored), described in the PR with their word counts per slide.
- PR body, technical-writing style: Why, Scope, Locks, Tradeoffs, Verification. Route URL after deploy. Then the footer.

Commit trailer:

```
Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01JEY3TbZJieW5tF6Af2zqm2
```

PR footer:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01JEY3TbZJieW5tF6Af2zqm2
```
