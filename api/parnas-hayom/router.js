import availability from '../../server/api/parnas-hayom/availability.js'
import checkout from '../../server/api/parnas-hayom/checkout.js'
import emailDiagnostics from '../../server/api/parnas-hayom/email-diagnostics.js'
import resendReceipt from '../../server/api/parnas-hayom/resend-receipt.js'
import status from '../../server/api/parnas-hayom/status.js'
import types from '../../server/api/parnas-hayom/types.js'
import verifyOverride from '../../server/api/parnas-hayom/verify-override.js'

const handlers = { availability, checkout, 'email-diagnostics': emailDiagnostics, 'resend-receipt': resendReceipt, status, types, 'verify-override': verifyOverride }

export default function handler(req, res) {
  const endpoint = req.query?.endpoint
  const selected = typeof endpoint === 'string' && Object.hasOwn(handlers, endpoint) ? handlers[endpoint] : null
  if (!selected) return res.status(404).json({ error: 'Unknown Parnas Hayom API endpoint.' })
  return selected(req, res)
}
