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
    at: shipment.review.at
  }
  addEvent(shipment, {
    type: 'note',
    actor: 'customer',
    note: `Customer left a ${rating}-star review${shipment.review.comment ? `: "${shipment.review.comment}"` : ''}${helpedBy ? ` · shout-out for ${helpedBy}` : ''}`
  })

  // 5★ earns the thank-you voucher straight away — no CS step. Google/Facebook
  // proof still goes through manual verification (`reward.post.ts`).
  let rewardCode: string | undefined
  if (rating === 5 && !shipment.review.reward) {
    rewardCode = thanksCode(shipment.id)
    shipment.review.reward = { code: rewardCode, at: new Date().toISOString(), value: 'Grab $10' }
    addEvent(shipment, {
      type: 'note',
      actor: 'system',
      note: `⭐ 5-star review — thank-you voucher ${rewardCode} issued automatically`
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
