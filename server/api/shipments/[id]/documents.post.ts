export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const shipment = id ? await dbGetShipment(id) : undefined
  if (!shipment?.documents) {
    throw createError({ statusCode: 404, statusMessage: 'Shipment has no document checklist' })
  }

  const body = await readBody(event)
  const doc = shipment.documents.find((d) => d.key === body?.key)
  if (!doc) {
    throw createError({ statusCode: 404, statusMessage: 'Document not found' })
  }

  if (body.action === 'upload') {
    if (typeof body.file !== 'string' || !body.file.startsWith('data:')) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid file' })
    }
    doc.file = body.file
    doc.fileName = body.fileName ? String(body.fileName) : 'document'
    doc.status = 'uploaded'
    doc.uploadedBy = body.by ? String(body.by) : 'Customer'
    doc.at = new Date().toISOString()
    addEvent(shipment, { type: 'note', actor: 'customer', note: `📄 ${doc.label} uploaded (${doc.fileName})` })
    await dbSaveShipment(shipment)
    return doc
  }

  if (body.action === 'approve') {
    doc.status = 'approved'
    doc.at = new Date().toISOString()
    addEvent(shipment, { type: 'note', actor: 'cs', note: `✅ ${doc.label} verified by M&P` })
    await dbSaveShipment(shipment)
    return doc
  }

  throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
})
