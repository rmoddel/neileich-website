import login from '../server/api/around-the-commons/auth/login.js'
import logout from '../server/api/around-the-commons/auth/logout.js'
import ingest from '../server/api/around-the-commons/ingest.js'
import session from '../server/api/newsletter/session.js'
import issue from '../server/api/newsletter/issue.js'
import draft from '../server/api/newsletter/draft.js'
import bulkImport from '../server/api/newsletter/bulk-import.js'
import approve from '../server/api/newsletter/approve.js'
import shabbos from '../server/api/newsletter/shabbos.js'
import announcement from '../server/api/newsletter/announcement.js'

export const config = { maxDuration: 120 }

const handlers = {
  login, logout, ingest, session, issue, draft, approve, shabbos, announcement, 'bulk-import': bulkImport,
}

export default function handler(req, res) {
  const endpoint = req.query?.endpoint
  const selected = typeof endpoint === 'string' && Object.hasOwn(handlers, endpoint) ? handlers[endpoint] : null
  if (!selected) return res.status(404).json({ error: 'Unknown ATC API endpoint.' })
  return selected(req, res)
}
