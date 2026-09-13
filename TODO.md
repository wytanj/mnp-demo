# M&P demo — done so far, and next

Live: https://mnp-flow.vercel.app  
This repo is **not a git repo**. Production is a `vercel deploy --prod` of the local folder (`wytanjs-projects/mnp-flow`). Data lives in Supabase; emails go out via Resend (`RESEND_TO` reroutes live sends).

---

## Done

### Already in the demo before this stretch
- Operations dashboard: book B2B / B2C / B2SELF, copy tracking link
- Customer tracking page with live timeline, document checklist, e-sign POD
- Driver portal (phone login, photos, status)
- Quotes, rate cards, Titan SOA
- Automated outbound mail: booking confirmation, review request on sign-off, voucher after CS approve
- Inbound Resend webhook → Grok draft reply
- MCP connector for “what’s outstanding / send an email”
- Seeded jobs (Allmighty, Hey Fran, Mecha, Titan) plus extra seed script

### Review rewards dashboard
- `/rewards` — full CS dashboard: clients, reviews given, rewards given, automatic functions
- Operations page: compact rewards card (KPIs, pending proof, **Open dashboard**)
- Top bar: Operations | Rewards
- Grab $10 giveaway framing (Google / Facebook proof)
- Approve & send still emails the voucher code
- Funnel + per-shipment automation pipeline
- “Review reminder (48h)” shown as **Planned**, not live
- Demo data: reviews/vouchers on Allmighty, Hey Fran, Titan; Esther’s Google proof on `MP-8110-AF` waiting to verify

### Per-shipment mail log
- The **job** is the thread, not the inbox
- Inbound + outbound stored against `shipmentId`
- Match order: job id in subject/body → booking address → known alias → company domain
- **Never** match Gmail / SingNet / other consumer mailboxes by domain
- New addresses remembered on the shipment (`contacts`)
- Operations: **Mail log** on each job + global In/Out feed
- Demo threads: Esther `@allmightyfoods` on `MP-4471-AF`, Brendan Gmail on `MP-3318-MC`, WY Gmail on `MP-1633-TA`, WY SingNet on `MP-2008-TA`

### Safer compose button (live APIs)
- Every mail row shows **From** and **To**
- If Resend rerouted (`RESEND_TO`), **Resend delivered to** is shown separately
- Removed the one-click primary “Send via mail client”
- Two-step: Compose/Reply… → confirm that names the exact address → opens *your* mail app (not Resend)
- Inbound replies go to the **sender**, not `cs@mp.com.sg`

### Deploy
- Rewards dashboard, mail log, and safer compose are on production
- Last prod alias: https://mnp-flow.vercel.app

---

## Next (suggested)

### Mail / CS
- [ ] Unmatched inbound queue — Gmail with no job id, or a company domain with several open jobs, should land in “needs a human” not on the wrong file
- [ ] When company domain hits multiple active jobs, ask CS to pick instead of auto-picking the most recent
- [ ] Drop or further gate “compose a copy” on already-sent live mail (mail app bypasses `RESEND_TO`)
- [ ] Show the AI draft on the shipment before/after it sends; allow CS to edit
- [ ] Quote WhatsApp / email threads (`quote.updates`) into the same per-job log

### Rewards
- [ ] Build the 48h review reminder (currently planned only)
- [ ] Distinguish “in-app review” vs “public proof” more strictly in the approve queue
- [ ] Optional: two-voucher path when both Google and Facebook proof are uploaded (per the flyer)

### Product / demo
- [ ] Init git so deploys are reviewable (right now only `vercel deploy`)
- [ ] Phase 2/3 copy on the ops page is behind the product — driver updates and e-sign/reviews are already in the demo
- [ ] Refresh `README.md` seed table (jobs and the `/rewards` + mail-log story are missing)
- [ ] Customer track page: do **not** expose the CS mail thread; maybe a “message us” that always quotes the job id

### Housekeeping
- [ ] `scripts/seed-inbound.mjs` / `scripts/seed-extra.mjs` — one documented reseed path
- [ ] Empty-state / mobile pass on the rewards tables
- [ ] Don’t leave `_verify-*.png` or one-shot patch scripts in `public/` / `scripts/`
