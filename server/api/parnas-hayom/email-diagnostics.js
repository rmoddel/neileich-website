import { badRequest, DEFAULT_EMAIL_FROM, resolveEmailFrom, senderDomain, VERIFIED_EMAIL_DOMAIN } from '../_lib/parnas.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return badRequest(res, 'Method not allowed', 405)
  const { overrideCode } = req.body || {}
  if (!process.env.PARNAS_OVERRIDE_CODE || overrideCode !== process.env.PARNAS_OVERRIDE_CODE) return badRequest(res, 'The override code is not valid.', 403)

  const configuredFrom = String(process.env.EMAIL_FROM || '').trim()
  const selectedFrom = resolveEmailFrom()
  const diagnostics = {
    resendApiKeyPresent: Boolean(process.env.RESEND_API_KEY),
    configuredFromPresent: Boolean(configuredFrom),
    configuredFromDomain: senderDomain(configuredFrom),
    selectedFrom,
    selectedFromDomain: senderDomain(selectedFrom),
    usingDefaultSender: selectedFrom === DEFAULT_EMAIL_FROM,
    expectedVerifiedDomain: VERIFIED_EMAIL_DOMAIN,
    resendDomainLookup: { checked: false },
  }

  if (!process.env.RESEND_API_KEY) return res.status(200).json(diagnostics)

  try {
    const { Resend } = await import('resend')
    const result = await new Resend(process.env.RESEND_API_KEY).domains.list({ limit: 100 })
    if (result.error) {
      diagnostics.resendDomainLookup = { checked: true, ok: false, error: result.error.message || 'Domain lookup failed' }
      return res.status(200).json(diagnostics)
    }
    const domains = result.data?.data || []
    const neileich = domains.find((domain) => domain.name?.toLowerCase() === VERIFIED_EMAIL_DOMAIN)
    diagnostics.resendDomainLookup = {
      checked: true,
      ok: true,
      domainCount: domains.length,
      neileichStatus: neileich?.status || 'missing',
      neileichRegion: neileich?.region || null,
    }
    return res.status(200).json(diagnostics)
  } catch (error) {
    diagnostics.resendDomainLookup = { checked: true, ok: false, error: error.message || 'Domain lookup failed' }
    return res.status(200).json(diagnostics)
  }
}
