import type { OutboxEmail } from '#shared/utils/shipping'

const SITE = 'https://mnp-flow.vercel.app'

// M&P brand template — charcoal #221F1F header, orange #F17421 accent,
// table layout + inline styles for email-client compatibility
function renderHtml(e: OutboxEmail): string {
  // signature line is rendered in the footer instead
  const body = e.body.replace(/\n?— M&P International Freights.*$/s, '').trim()
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f0f1f3">
<div style="background:#f0f1f3;padding:28px 12px;font-family:'Segoe UI',Arial,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
    <tr>
      <td style="background:#221f1f;padding:20px 28px">
        <span style="color:#ffffff;font-size:17px;font-weight:700;letter-spacing:0.3px">M&amp;P <span style="color:#f17421">INTERNATIONAL FREIGHTS</span></span>
      </td>
    </tr>
    <tr><td style="height:4px;background:#f17421;font-size:0;line-height:0">&nbsp;</td></tr>
    <tr>
      <td style="padding:28px">
        <div style="white-space:pre-line;color:#221f1f;font-size:14px;line-height:1.65">${esc(body)}</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px">
          <tr>
            <td style="background:#f17421;border-radius:8px">
              <a href="${SITE}${e.ctaUrl}" style="display:inline-block;padding:13px 26px;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none">${esc(e.ctaLabel)}</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:16px 28px;background:#fafafa;border-top:1px solid #eeeeee;color:#69727d;font-size:12px;line-height:1.6">
        M&amp;P International Freights Pte Ltd · 37 Jalan Pemimpin, Mapex, Singapore 577177<br>
        <span style="color:#f17421;font-weight:700">Moving you forward</span> · <a href="https://www.mp.com.sg" style="color:#69727d">mp.com.sg</a>
      </td>
    </tr>
  </table>
</div>
</body></html>`
}

// Sends via Resend and records the outcome on the email object. Never throws —
// a mail failure must not break the booking/signoff flow.
export async function sendEmail(e: OutboxEmail): Promise<void> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    e.delivery = { state: 'simulated', to: e.to, detail: 'RESEND_API_KEY not set' }
    return
  }
  // Demo safety: seed addresses aren't real — RESEND_TO reroutes all mail
  const to = process.env.RESEND_TO || e.to
  const from = process.env.RESEND_FROM || 'M&P International Freights <tracking@pickletour.app>'
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from, to, subject: e.subject, html: renderHtml(e), text: e.body })
    })
    const data: any = await res.json().catch(() => ({}))
    e.delivery = res.ok
      ? { state: 'sent', to, detail: data.id }
      : { state: 'failed', to, detail: `${res.status} ${data?.message ?? ''}`.trim() }
  } catch (err: any) {
    e.delivery = { state: 'failed', to, detail: err?.message }
  }
}
