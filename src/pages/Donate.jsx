import { useEffect, useMemo, useRef, useState } from 'react'
import './Donate.css'

const money = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)

export default function Donate() {
  const query = useMemo(() => new URLSearchParams(window.location.search), [])
  const [form, setForm] = useState({ amount: '', donorName: '', donorEmail: '', donorPhone: '' })
  const [expiry, setExpiry] = useState('')
  const [ready, setReady] = useState(false)
  const [paying, setPaying] = useState(query.get('payment') === 'processing')
  const [error, setError] = useState('')
  const [donationId, setDonationId] = useState(query.get('donation'))
  const [receiptToken, setReceiptToken] = useState(query.get('receipt'))
  const [receipt, setReceipt] = useState(null)
  const tokenInputs = useRef(null)

  useEffect(() => {
    const initialize = () => {
      if (!window.setAccount || !import.meta.env.VITE_SOLA_IFIELDS_KEY) return
      window.setAccount(import.meta.env.VITE_SOLA_IFIELDS_KEY, 'Neileich', '1.0.0')
      const style = { width: '100%', height: '42px', border: '0', outline: 'none', 'font-size': '16px', 'font-family': 'Inter, Arial, sans-serif' }
      window.setIfieldStyle?.('card-number', style)
      window.setIfieldStyle?.('cvv', style)
      window.enableAutoFormat?.(' ')
      setReady(true)
    }
    const existing = document.getElementById('sola-ifields-script')
    if (existing) { existing.addEventListener('load', initialize); initialize(); return () => existing.removeEventListener('load', initialize) }
    const script = document.createElement('script')
    script.id = 'sola-ifields-script'
    script.src = 'https://cdn.cardknox.com/ifields/2.15.2309.2601/ifields.min.js'
    script.async = true
    script.addEventListener('load', initialize)
    script.addEventListener('error', () => setError('Secure card fields could not load. Please refresh and try again.'))
    document.head.appendChild(script)
    return () => script.removeEventListener('load', initialize)
  }, [])

  useEffect(() => {
    if (!donationId || !receiptToken || !paying) return
    let cancelled = false
    const check = async () => {
      try {
        const response = await fetch(`/api/donations/status?donationId=${encodeURIComponent(donationId)}&receiptToken=${encodeURIComponent(receiptToken)}`)
        const result = await response.json()
        if (cancelled) return
        if (result.status === 'confirmed' && result.paymentStatus === 'paid') { setReceipt(result.receipt); setPaying(false); return }
        if (['failed', 'cancelled'].includes(result.status)) { setError('Your payment was not completed. Please try again.'); setPaying(false); return }
        window.setTimeout(check, 1000)
      } catch { window.setTimeout(check, 1500) }
    }
    check()
    return () => { cancelled = true }
  }, [donationId, paying, receiptToken])

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const submit = (event) => {
    event.preventDefault()
    if (!ready || !window.getTokens || !tokenInputs.current) return setError('Secure card fields are still loading. Please try again.')
    if (!/^\d{4}$/.test(expiry)) return setError('Enter your card expiration as MMYY.')
    setError('')
    window.getTokens(async () => {
      const cardToken = tokenInputs.current.querySelector('[data-ifields-id="card-number-token"]')?.value
      const cvvToken = tokenInputs.current.querySelector('[data-ifields-id="cvv-token"]')?.value
      if (!cardToken || !cvvToken) return setError('Please complete your card number and CVV.')
      setPaying(true)
      try {
        const response = await fetch('/api/donations/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, cardExpiry: expiry, cardToken, cvvToken }) })
        const payload = await response.json().catch(() => ({}))
        if (!response.ok || !payload.pending) throw new Error(payload.error || 'We could not process your donation. Please try again.')
        setDonationId(payload.donationId)
        setReceiptToken(payload.receiptToken)
        window.history.replaceState({}, '', `/donate?payment=processing&donation=${payload.donationId}&receipt=${payload.receiptToken}`)
      } catch (caught) { setError(caught.message); setPaying(false) }
    })
  }

  if (receipt) return <div className="donate-page"><section className="donate-success"><img src="/logo-english.png" alt="Neileich" /><p>DONATION CONFIRMED</p><h1>Thank you for supporting Neileich.</h1><strong>{money(receipt.amountCents)}</strong><dl><div><dt>Donor</dt><dd>{receipt.donorName}</dd></div><div><dt>Email</dt><dd>{receipt.donorEmail}</dd></div>{receipt.donorPhone && <div><dt>Phone</dt><dd>{receipt.donorPhone}</dd></div>}{receipt.paymentReference && <div><dt>Payment reference</dt><dd>{receipt.paymentReference}</dd></div>}</dl><span>A receipt has been sent to your email.</span></section></div>

  return <div className="donate-page"><section className="donate-hero"><div className="container"><p>SUPPORT NEILEICH</p><h1>Give any amount.</h1><span>Every gift helps children and families thrive.</span></div></section><main className="container donate-shell"><form className="donate-card" onSubmit={submit}><h2>Make a secure donation</h2><p>Choose the amount that is meaningful to you.</p><label>Donation amount<input required name="amount" value={form.amount} onChange={change} type="number" min="1" max="1000000" step="0.01" inputMode="decimal" placeholder="0.00" /></label><div className="donate-grid"><label>Full name<input required name="donorName" value={form.donorName} onChange={change} autoComplete="name" /></label><label>Email<input required type="email" name="donorEmail" value={form.donorEmail} onChange={change} autoComplete="email" /></label></div><label>Phone <em>(optional)</em><input name="donorPhone" value={form.donorPhone} onChange={change} autoComplete="tel" /></label><section className="donate-payment"><h3>Secure card payment</h3><p>Your card details are securely handled by Sola Payments.</p><label>Card number<iframe title="Secure card number" data-ifields-id="card-number" data-ifields-placeholder="Card number" src="https://cdn.cardknox.com/ifields/2.15.2309.2601/ifield.htm" /></label><div className="donate-grid"><label>Expiration (MMYY)<input required value={expiry} onChange={(event) => setExpiry(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" autoComplete="cc-exp" placeholder="MMYY" /></label><label>CVV<iframe title="Secure card CVV" data-ifields-id="cvv" data-ifields-placeholder="CVV" src="https://cdn.cardknox.com/ifields/2.15.2309.2601/ifield.htm" /></label></div><div ref={tokenInputs}><input name="xCardNum" data-ifields-id="card-number-token" type="hidden" /><input name="xCVV" data-ifields-id="cvv-token" type="hidden" /></div></section>{error && <p className="donate-error">{error}</p>}<button className="donate-button" disabled={paying}>{paying ? 'Confirming your donation…' : form.amount ? `Donate $${form.amount}` : 'Donate securely'}</button><small>Your card information is never stored by Neileich.</small></form></main></div>
}
