# Brief: Fix M&P Review programme card bugs

Branch: demo/tuesday-hygiene-musthaves (this worktree). Push to PR #1.

## Bugs (fix all)
1. Seed s12 (MP-7710-AF): add reviewAsk sent + timeline so outbox matches Pending asks.
2. Pending claim of reward → bind to `awaiting` (or unclaimed), NOT `issued`.
3. Held: show `reason ?? gate ?? Held by CS`; reviewAskDecision + maybeSendReviewAsk respect held until release.
4. row(): company trim || customerName; title/description; B2C seeds get company Allmighty where appropriate.
5. Outbox: show client name with email.
6. Optional: group by client or Client/By job toggle; align Received KPI with a real list or rename.

## Acceptance
Soft-reload /ops/rewards: outbox count matches visible programme rows; pending claim ≠ vouchers issued; held shows reasons; Priya cards have company. Local build. Push PR #1. Webhook if available.

ROLE SPLIT. Stay in this worktree.
