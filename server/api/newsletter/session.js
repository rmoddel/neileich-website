import { session } from '../_lib/newsletter-auth.js'

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') return res.status(405).end()
  const user = await session(req)
  return user ? res.status(200).json({ user }) : res.status(401).json({ error: 'Sign in required' })
}
