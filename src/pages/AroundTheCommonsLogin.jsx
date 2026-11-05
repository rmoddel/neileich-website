import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AroundTheCommonsLogin.css'

export default function AroundTheCommonsLogin() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    fetch('/api/newsletter/session', { credentials: 'same-origin', cache: 'no-store' })
      .then(response => { if (response.ok && active) navigate('/around-the-commons', { replace: true }) })
      .catch(() => {})
      .finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [navigate])
  async function submit(event) {
    event.preventDefault()
    setLoading(true); setError('')
    try {
      const response = await fetch('/api/around-the-commons/auth/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || 'Sign-in is unavailable. Please try again.')
      setPassword('')
      navigate(data.redirect || '/around-the-commons', { replace: true })
    } catch (cause) { setError(cause.message) }
    finally { setLoading(false) }
  }
  return <div className="atc-login-page">
    <div className="atc-login-card">
      <div className="atc-login-brand"><img src="/logo-english.png" alt="Neileich" /><span>NEWSLETTER EDITOR</span></div>
      <h1>Around the Commons</h1>
      <p className="atc-login-intro">Sign in to prepare and approve this week’s newsletter.</p>
      {checking ? <p className="atc-login-check">Checking your session…</p> : <form onSubmit={submit}>
        <label htmlFor="atc-username">Username</label>
        <input id="atc-username" name="username" autoComplete="username" value={username} onChange={event => setUsername(event.target.value)} required autoFocus />
        <label htmlFor="atc-password">Password</label>
        <div className="atc-password-field"><input id="atc-password" name="password" type={visible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required /><button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? 'Hide password' : 'Show password'}>{visible ? 'Hide' : 'Show'}</button></div>
        {error && <p className="atc-login-error" role="alert">{error}</p>}
        <button className="atc-login-submit" type="submit" disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>}
      <p className="atc-login-help">Authorized Neileich administrators only.</p>
    </div>
  </div>
}
