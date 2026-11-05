import { Readable } from 'node:stream'
import { requireSession } from '../../_lib/newsletter-auth.js'
import { getPrivateChart } from '../../_lib/newsletter-zmanim.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store')
  if (req.method !== 'GET') return res.status(405).end()
  if (!await requireSession(req, res)) return
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(req.query?.id || '')) return res.status(400).end()
  try {
    const source = await getPrivateChart(req.query.id)
    if (!source?.stream) return res.status(404).end()
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'inline; filename="zmanim-chart.pdf"')
    Readable.fromWeb(source.stream).pipe(res)
  } catch (error) {
    console.error('Private chart read failed', error.message)
    return res.status(503).end()
  }
}
