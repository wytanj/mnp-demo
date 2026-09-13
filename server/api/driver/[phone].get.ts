function normalize(phone: string): string {
  return phone.replace(/\D/g, '').slice(-8)
}

export default defineEventHandler(async (event) => {
  const phone = normalize(getRouterParam(event, 'phone') ?? '')
  if (phone.length < 8) {
    throw createError({ statusCode: 400, statusMessage: 'Enter a valid phone number' })
  }

  const shipments = await dbGetShipments()
  const jobs = shipments.filter((s) => s.driverPhone && normalize(s.driverPhone) === phone)
  if (!jobs.length) {
    throw createError({ statusCode: 404, statusMessage: 'No jobs found for this number — check with dispatch' })
  }

  return {
    driverName: jobs[0]!.driverName,
    jobs: jobs
      .sort((a, b) => a.eta.localeCompare(b.eta))
      .map((s) => ({
        id: s.id,
        status: s.status,
        origin: s.origin,
        destination: s.destination,
        eta: s.eta,
        vehicle: s.vehicle,
        description: s.description,
        pieces: s.pieces,
        weightKg: s.weightKg,
        signedOff: !!s.signoff
      }))
  }
})
