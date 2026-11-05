import checkout from '../../server/api/donations/checkout.js'
import status from '../../server/api/donations/status.js'
import resendReceipt from '../../server/api/donations/resend-receipt.js'

const handlers = { checkout, status, 'resend-receipt': resendReceipt }

export default function handler(req, res) {
  const endpoint = req.query?.endpoint
  const selected = typeof endpoint === 'string' && Object.hasOwn(handlers, endpoint) ? handlers[endpoint] : null
  if (!selected) return res.status(404).json({ error: 'Unknown donations API endpoint.' })
  return selected(req, res)
}
