import { programmeOf } from '#shared/utils/shipping'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const shipment = id ? await dbGetShipment(id) : undefined
  if (!shipment) {
    throw createError({ statusCode: 404, statusMessage: 'Shipment not found' })
  }

  const body = await readBody(event)
  const rating = Number(body?.rating)
  if (!rating || rating < 1 || rating > 5) {
    throw createError({ statusCode: 400, statusMessage: 'Rating must be 1-5' })
  }

  const screenshot =
    typeof body.screenshot === 'string' && body.screenshot.startsWith('data:image/')
      ? body.screenshot
      : undefined

  const helpedBy = body.helpedBy ? String(body.helpedBy).trim() : ''

  // Which public platform(s) the customer says they posted on. Ignore anything else.
  const platforms = Array.isArray(body.platforms)
    ? (body.platforms.filter((p: unknown) => p === 'google' || p === 'facebook') as Array<
        'google' | 'facebook'
      >)
    : []

  shipment.review = {
    rating,
    comment: body.comment ? String(body.comment) : '',
    at: new Date().toISOString(),
    screenshot,
    platforms: platforms.length ? [...new Set(platforms)] : undefined,
    helpedBy: helpedBy || undefined
  }
  shipment.reviewAsk = {
    ...(shipment.reviewAsk ?? {}),
    state: 'answered',
    at: shipment.review.at,
    scheduledFor: undefined
  }
  addEvent(shipment, {
    type: 'note',
    actor: 'customer',
    note: `Customer left a ${rating}-star review${shipment.review.comment ? `: "${shipment.review.comment}"` : ''}${helpedBy ? ` · shout-out for ${helpedBy}` : ''}`
  })

  // Only the 5★ auto programme pays out by itself. Public-proof programmes wait
  // for CS to verify the screenshot, and B2B credits are issued by hand — both
  // go through `reward.post.ts`.
  const programme = programmeOf(shipment)
  let rewardCode: string | undefined
  if (rating === 5 && programme.reward.auto === 'five_star' && !shipment.review.reward) {
    rewardCode = thanksCode(shipment.id)
    shipment.review.reward = { code: rewardCode, at: new Date().toISOString(), value: programme.reward.value }
    addEvent(shipment, {
      type: 'note',
      actor: 'system',
      note: `⭐ 5-star review — ${programme.reward.value} voucher ${rewardCode} issued automatically`
    })
  } else if (programme.reward.auto !== 'five_star' && !shipment.review.reward) {
    addEvent(shipment, {
      type: 'note',
      actor: 'system',
      note: programme.reward.auto === 'verified_proof'
        ? `🔍 ${programme.name} — review awaiting CS verification before the ${programme.reward.value} voucher goes out`
        : `📝 ${programme.name} — ${programme.reward.value} is credited manually by the account manager`,
      internal: true
    })
  }

  await dbSaveShipment(shipment)

  if (rewardCode) {
    const email = buildRewardEmail(shipment, rewardCode)
    await sendEmail(email)
    await dbSaveEmail(email)
  }

  return shipment
})
