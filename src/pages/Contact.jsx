import { useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { BRAND } from '../data/extras.js'
import { AUTH_ENABLED, client } from '../lib/auth.js'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const TOPICS = ['A question about learning', 'Pro and payments', 'A mistake in the content', 'College or team access', 'Something else']

function mailto(v) {
  const body = `${v.message}\n\n— ${v.name} (${v.email})`
  return `mailto:${BRAND.email}?subject=${encodeURIComponent(`${BRAND.name}: ${v.topic}`)}&body=${encodeURIComponent(body)}`
}

export default function Contact() {
  const { search } = useLocation()
  const fromTopic = new URLSearchParams(search).get('topic')
  const [v, setV] = useState({ name: '', email: '', topic: TOPICS.includes(fromTopic) ? fromTopic : TOPICS[0], message: '', website: '' })
  const [state, setState] = useState('idle')
  const [err, setErr] = useState('')
  const opened = useRef(Date.now())
  const set = (k) => (e) => { setV({ ...v, [k]: e.target.value }); if (err) setErr('') }

  const submit = async (e) => {
    e.preventDefault()
    if (!v.name.trim()) return setErr('Please add your name.')
    if (!EMAIL.test(v.email.trim())) return setErr('That email looks incomplete.')
    if (v.message.trim().length < 10) return setErr('Please write a little more, so we can help.')
    // Spam guard: people never fill the hidden "website" field, and take more than 3 seconds to write.
    if (v.website || Date.now() - opened.current < 3000) { setState('done'); return }
    if (!AUTH_ENABLED) { window.location.href = mailto(v); setState('done'); return }
    setState('sending')
    try {
      const sb = await client()
      const { error } = await sb.from('contact_messages').insert({ name: v.name.trim(), email: v.email.trim().toLowerCase(), topic: v.topic, message: v.message.trim(), page: 'contact' })
      if (error) throw error
      setState('done')
    } catch (x) {
      setState('idle')
      setErr(x && x.code === 'P0001' ? 'Too many messages right now. Please try again in an hour, or email us directly.' : 'Could not send. Check your connection, or email us directly.')
    }
  }

  return (
    <div className="page">
      <div className="container narrow">
        <div className="page-head">
          <div className="eyebrow">Contact</div>
          <h1>Talk to us</h1>
          <p className="muted">Questions about learning, Pro, payments or a mistake you spotted: a real person reads every message and usually replies within two working days.</p>
        </div>

        <div className="contact-grid">
          <div className="card card-pad contact-card">
            <h2 className="contact-h">Email</h2>
            <p><a href={`mailto:${BRAND.email}`}>{BRAND.email}</a></p>
            <p className="small muted">Writing about a payment? Use the email on your account and include the payment ID from your receipt.</p>
            <h2 className="contact-h">Policies</h2>
            <p className="small"><Link to="/refund">Refund and cancellation</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link></p>
            <h2 className="contact-h">Run by</h2>
            <p className="small muted">{BRAND.author}, {BRAND.authorRole}.</p>
          </div>

          {state === 'done' ? (
            <div className="card waitlist waitlist-done" role="status">
              <div className="wl-ok" aria-hidden="true">✓</div>
              <h3>Message sent</h3>
              <p className="muted">Thanks, {v.name.trim().split(' ')[0] || 'friend'}. We'll reply to {v.email.trim() || 'your email'}.</p>
              <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link className="btn btn-primary" to="/learn">Back to learning</Link>
              </div>
            </div>
          ) : (
            <form className="card waitlist" onSubmit={submit} noValidate>
              <div className="wl-head"><h3>Send a message</h3></div>
              <div className="wl-grid">
                <label className="wl-f"><span>Your name</span><input value={v.name} onChange={set('name')} autoComplete="name" required maxLength={120} /></label>
                <label className="wl-f"><span>Email</span><input type="email" inputMode="email" value={v.email} onChange={set('email')} autoComplete="email" required maxLength={200} /></label>
              </div>
              <label className="wl-f"><span>Topic</span>
                <select className="contact-select" value={v.topic} onChange={set('topic')}>{TOPICS.map((t) => <option key={t}>{t}</option>)}</select>
              </label>
              <label className="wl-f"><span>Message</span><textarea rows={6} value={v.message} onChange={set('message')} required maxLength={4000} /></label>
              {/* Hidden from people; bots that fill every field reveal themselves. */}
              <label className="hp" aria-hidden="true">Website<input tabIndex={-1} autoComplete="off" value={v.website} onChange={set('website')} /></label>
              {err && <p className="wl-err" role="alert">{err}</p>}
              <button className="btn btn-primary btn-lg wl-btn" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Send message'}</button>
              <p className="small muted wl-fine">We use your email only to reply. See the <Link to="/privacy">privacy note</Link>.</p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
