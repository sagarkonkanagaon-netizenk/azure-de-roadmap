import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AUTH_ENABLED, client, loadProfile, sendEmailLink, verifyCode, signInWithGoogle, signOut, deviceLabel } from '../lib/auth.js'

export default function Account() {
  const [state, setState] = useState(AUTH_ENABLED ? 'loading' : 'off')
  const [profile, setProfile] = useState(null)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  // Where to go after signing in. Kept in sessionStorage so it survives the email-link round trip.
  useEffect(() => { const n = params.get('next'); if (n && n.startsWith('/')) { try { sessionStorage.setItem('dd:next', n) } catch (e) { /* ignore */ } } }, [params])
  useEffect(() => {
    if (state !== 'signed-in') return
    let n = null
    try { n = sessionStorage.getItem('dd:next'); sessionStorage.removeItem('dd:next') } catch (e) { /* ignore */ }
    if (n && n !== '/account') navigate(n, { replace: true })
  }, [state, navigate])

  async function refresh() {
    try {
      const p = await loadProfile()
      if (!p) setState('signed-out')
      else if (p.kicked) { setProfile(p); setState('kicked') }
      else { setProfile(p); setState('signed-in') }
    } catch (e) { setErr(e.message || String(e)); setState('signed-out') }
  }

  useEffect(() => {
    if (!AUTH_ENABLED) return
    let sub
    client().then((sb) => {
      sub = sb.auth.onAuthStateChange((event) => { if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') refresh() }).data.subscription
      refresh()
    })
    return () => sub && sub.unsubscribe()
  }, [])

  async function act(fn, next) {
    setErr(''); setBusy(true)
    try { await fn(); if (next) setState(next) } catch (e) { setErr(e.message || String(e)) } finally { setBusy(false) }
  }

  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  return (
    <div className="page">
      <div className="container narrow">
        <div className="page-head">
          <div className="eyebrow">Account</div>
          <h1>{state === 'signed-in' ? 'You\'re signed in' : 'Sign in'}</h1>
          <p className="muted">A free account gets you Pro launch news and early access. Every handbook, lab and quiz still works without one.</p>
        </div>

        <div className="card account-card">
          {state === 'off' && (
            <>
              <p>Accounts open when Pro launches. Until then, your progress is saved in this browser.</p>
              <div className="account-actions"><Link className="btn btn-primary" to="/pro">Join the Pro waitlist</Link><Link className="btn btn-ghost" to="/progress">Back up your progress</Link></div>
            </>
          )}

          {state === 'loading' && <p className="muted"><span className="spinner" /> Checking your account…</p>}

          {state === 'kicked' && (
            <>
              <p><b>You were signed out here</b> because your account was used on another device{profile?.other ? ` (${profile.other})` : ''}. Each account works on one device at a time.</p>
              <button className="btn btn-primary" onClick={() => setState('signed-out')}>Sign in on this device</button>
            </>
          )}

          {state === 'signed-out' && (
            <form onSubmit={(e) => { e.preventDefault(); if (validEmail) act(() => sendEmailLink(email.trim()), 'code') }}>
              <label className="wl-f">
                <span>Email</span>
                <input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              </label>
              <div className="account-actions">
                <button className="btn btn-primary" type="submit" disabled={busy || !validEmail}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
                <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => act(signInWithGoogle)}>Continue with Google</button>
              </div>
            </form>
          )}

          {state === 'code' && (
            <form onSubmit={(e) => { e.preventDefault(); act(() => verifyCode(email.trim(), code.trim())) }}>
              <p>We sent an email to <b>{email}</b>. Open the link on this device, or type the 6-digit code from the email.</p>
              <label className="wl-f">
                <span>Code</span>
                <input inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
              </label>
              <div className="account-actions">
                <button className="btn btn-primary" type="submit" disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Sign in'}</button>
                <button className="btn btn-ghost" type="button" onClick={() => setState('signed-out')}>Use a different email</button>
              </div>
            </form>
          )}

          {state === 'signed-in' && profile && (
            <>
              <dl className="account-facts">
                <dt>Email</dt><dd>{profile.email}</dd>
                <dt>Plan</dt><dd>{profile.plan === 'pro' ? `Pro${profile.pro_until ? `, until ${profile.pro_until}` : ''}` : 'Free'}</dd>
                <dt>This device</dt><dd>{profile.device_label || deviceLabel()}</dd>
              </dl>
              <p className="small muted">Your account works on one device at a time. Signing in somewhere else signs you out here.</p>
              <div className="account-actions"><button className="btn btn-ghost" disabled={busy} onClick={() => act(signOut, 'signed-out')}>Sign out</button></div>
            </>
          )}

          {err && <p className="err" role="alert">{err}</p>}
        </div>
      </div>
    </div>
  )
}
