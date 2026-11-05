import { randomUUID, createHmac } from 'node:crypto'
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { parseCookie, stringifySetCookie } from 'cookie'
import { neon } from '@neondatabase/serverless'

const cookieName = 'atc_session'
const issuer = 'neileich-atc'
const audience = 'atc-editor'
const loginError = 'Invalid username or password.'

function local(req) { return process.env.ATC_LOCAL_DEV === '1' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '') }
function origin(req) {
  if (local(req)) return `http://${req.headers.host}`
  if (!process.env.APP_URL) throw new Error('APP_URL is not configured')
  const configured = new URL(process.env.APP_URL)
  if (configured.protocol !== 'https:') throw new Error('APP_URL must use HTTPS')
  return configured.origin
}
function maxAgeSeconds() {
  const hours = Number(process.env.ATC_SESSION_MAX_AGE_HOURS || 12)
  if (!Number.isInteger(hours) || hours < 1 || hours > 168) throw new Error('ATC_SESSION_MAX_AGE_HOURS must be 1 to 168')
  return hours * 3600
}
function key() {
  const value = process.env.ATC_AUTH_SESSION_SECRET
  if (!value || Buffer.byteLength(value) < 32) throw new Error('ATC_AUTH_SESSION_SECRET must be at least 32 bytes')
  return new TextEncoder().encode(value)
}
function db() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for ATC sessions')
  return neon(process.env.DATABASE_URL)
}
function credentials() {
  const username = process.env.ATC_AUTH_USERNAME
  const hash = process.env.ATC_AUTH_PASSWORD_HASH
  if (!username || !/^\$2[aby]\$(1[2-9]|2[0-9]|3[01])\$/.test(hash || '')) throw new Error('ATC administrator credentials are not configured with a bcrypt cost of at least 12')
  return { username, hash }
}
function cookieOptions(req, maxAge) {
  return { httpOnly: true, secure: !local(req), sameSite: 'strict', path: '/', maxAge }
}
export function clearSession(req, res) {
  res.setHeader('Set-Cookie', stringifySetCookie({ name: cookieName, value: '', ...cookieOptions(req, 0) }))
}
export async function createSession(req, res, username, sql = db()) {
  const maxAge = maxAgeSeconds()
  const sessionId = randomUUID()
  const expiresAt = new Date(Date.now() + maxAge * 1000).toISOString()
  await sql`insert into newsletter_sessions (session_id, username, expires_at) values (${sessionId}, ${username}, ${expiresAt})`
  const token = await new SignJWT({ role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setIssuer(issuer).setAudience(audience).setSubject(username).setJti(sessionId).setIssuedAt().setExpirationTime(`${maxAge}s`).sign(key())
  res.setHeader('Set-Cookie', stringifySetCookie({ name: cookieName, value: token, ...cookieOptions(req, maxAge) }))
}
export async function session(req, sql) {
  const token = parseCookie(req.headers.cookie || '')[cookieName]
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key(), { issuer, audience, algorithms: ['HS256'] })
    if (payload.sub !== process.env.ATC_AUTH_USERNAME || payload.role !== 'admin') return null
    const query = sql || db()
    const rows = await query`select session_id from newsletter_sessions where session_id = ${payload.jti} and username = ${payload.sub} and expires_at > now() limit 1`
    if (!rows.length) return null
    return { username: payload.sub, approver: true }
  } catch { return null }
}
export async function revokeSession(req, res, sql) {
  const token = parseCookie(req.headers.cookie || '')[cookieName]
  if (token) {
    let payload
    try { ({ payload } = await jwtVerify(token, key(), { issuer, audience, algorithms: ['HS256'] })) }
    catch { /* Invalid or expired cookies can still be cleared. */ }
    if (payload?.jti) {
      const query = sql || db()
      await query`delete from newsletter_sessions where session_id = ${payload.jti}`
    }
  }
  clearSession(req, res)
}
export async function requireSession(req, res) {
  const user = await session(req)
  if (!user) res.status(401).json({ error: 'Sign in to Around the Commons.' })
  return user
}
export function requireOrigin(req, res) {
  try {
    if (req.headers.origin === origin(req)) return true
  } catch { /* Missing or invalid origin configuration. */ }
  res.status(403).json({ error: 'Invalid request origin.' })
  return false
}
export async function verifyCredentials(username, password, expected = credentials()) {
  const matches = typeof password === 'string' && password.length <= 1024 && await bcrypt.compare(password, expected.hash)
  return username === expected.username && matches
}
function loginKey(req) {
  const address = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
  return createHmac('sha256', key()).update(address).digest('hex')
}
async function countAttempt(sql, attemptKey, windowStart) {
  const rows = await sql`insert into newsletter_login_attempts (attempt_key, window_start, attempts) values (${attemptKey}, ${windowStart}, 1) on conflict (attempt_key, window_start) do update set attempts = newsletter_login_attempts.attempts + 1 returning attempts`
  return rows[0].attempts
}
export async function authenticate(req, res, username, password, sql = db()) {
  const expected = credentials()
  const windowStart = new Date(Math.floor(Date.now() / 900000) * 900000).toISOString()
  const [ipCount, globalCount] = await Promise.all([
    countAttempt(sql, `ip:${loginKey(req)}`, windowStart),
    countAttempt(sql, 'all', windowStart),
  ])
  if (ipCount > 5 || globalCount > 30) return { ok: false, status: 429, error: 'Too many sign-in attempts. Please try again in 15 minutes.' }
  if (!await verifyCredentials(username, password, expected)) return { ok: false, status: 401, error: loginError }
  await createSession(req, res, expected.username, sql)
  return { ok: true, user: { username: expected.username, approver: true } }
}
