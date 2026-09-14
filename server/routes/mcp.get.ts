export default defineEventHandler((event) => {
  // Streamable HTTP clients may probe GET for an SSE stream; we are stateless
  setResponseStatus(event, 405)
  return {
    name: 'mnp-flow-tracking',
    transport: 'streamable-http (POST only)',
    hint: 'POST JSON-RPC to this URL with ?key=<api-key>. Tools: list_shipments, get_shipment, list_pending_actions, list_customs_gaps, list_open_comms, list_partner_waits, list_exceptions, send_email, send_whatsapp.',
    tools: [
      'list_shipments',
      'get_shipment',
      'list_pending_actions',
      'list_customs_gaps',
      'list_open_comms',
      'list_partner_waits',
      'list_exceptions',
      'send_email',
      'send_whatsapp'
    ]
  }
})
