import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { WAITLIST, PLAN_CHOICES, STAGE_CHOICES } from '../data/waitlist.js'
import { BRAND } from '../data/extras.js'
import { AUTH_ENABLED, client } from '../lib/auth.js'

const KEY = 'dd:waitlist'
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null } catch (e) { return null } }
const save = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)) } catch (e) { /* private mode: fine */ } }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const googleForm = () => !!(WAITLIST.formId && WAITLIST.fields.email)
export const connected = () => AUTH_ENABLED || googleForm()

async function send(v) {
  if (AUTH_ENABLED) {
    // Saved in your Supabase project (table: waitlist). Joining twice with the same email is fine.
    const sb = await client()
    const { error } = await sb.from('waitlist').insert({ name: v.name.trim(), email: v.email.trim().toLowerCase(), plan: v.plan, stage: v.stage, want: v.want.trim() || null, source: 'site' })
    if (error && error.code !== '23505') throw error
    return
  }
  const f = WAITLIST.fields
  const body = new URLSearchParams()
  const put = (k, val) => { if (f[k] && val) body.append(f[k], val) }
  put('name', v.name); put('email', v.email); put('plan', v.plan); put('stage', v.stage); put('want', v.want)
  // Google Forms sends no CORS headers, so the reply is opaque. A network error still throws.
  await fetch(`https://docs.google.com/forms/d/e/${WAITLIST.formId}/formResponse`, { method: 'POST', mode: 'no-cors', body })
}

function mailto(v) {
  const lines = [`Name: ${v.name}`, `Email: ${v.email}`, `Plan: ${v.plan}`, `Where I am: ${v.stage}`, `What I want most: ${v.want || '-'}`]
  return `mailto:${BRAND.email}?subject=${encodeURIComponent(BRAND.name + ' Pro waitlist')}&body=${encodeURIComponent('Please add me to the Pro waitlist.\n\n' + lines.join('\n'))}`
}

export default function Waitlist({ plan: planProp }) {
  const [v, setV] = useState({ name: '', email: '', plan: '1 year', stage: '', want: '' })
  const [state, setState] = useState(() => (read() ? 'done' : 'idle'))
  const [err, setErr] = useState('')
  useEffect(() => { if (planProp) setV((x) => ({ ...x, plan: planProp })) }, [planProp])
  const set = (k) => (e) => { setV({ ...v, [k]: e.target.value }); if (err) setErr('') }

  const submit = async (e) => {
    e.preventDefault()
    if (!v.name.trim()) return setErr('Please add your name.')
    if (!EMAIL.test(v.email.trim())) return setErr('That email looks incomplete.')
    if (!v.stage) return setErr('Pick where you are now.')
    setErr('')
    if (!connected()) { window.location.href = mailto(v); save({ at: Date.now(), via: 'email' }); setState('done'); return }
    setState('sending')
    try { await send(v); save({ at: Date.now(), plan: v.plan }); setState('done') }
    catch (x) { setState('idle'); setErr('Could not reach the form. Check your connection and try again.') }
  }

  if (state === 'done') {
    return (
      <div className="card waitlist waitlist-done" role="status">
        <div className="wl-ok" aria-hidden="true">✓</div>
        <h3>You're on the list</h3>
        <p className="muted">We'll email you the day Pro opens. Until then, keep going on the path.</p>
        <div className="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" to="/path">Continue learning</Link>
          <button className="btn btn-ghost" onClick={() => { try { localStorage.removeItem(KEY) } catch (e) { /* ignore */ } setV({ name: '', email: '', plan: v.plan, stage: '', want: '' }); setState('idle') }}>Add someone else</button>
        </div>
      </div>
    )
  }

  return (
    <form className="card waitlist" onSubmit={submit} noValidate>
      <div className="wl-head">
        <h3>Join the waitlist</h3>
        <p className="muted small">Takes 20 seconds. No payment, no spam: one email when Pro opens.</p>
      </div>
      <div className="wl-grid">
        <label className="wl-f"><span>Your name</span><input value={v.name} onChange={set('name')} autoComplete="name" placeholder="Priya Sharma" required /></label>
        <label className="wl-f"><span>Email</span><input type="email" inputMode="email" value={v.email} onChange={set('email')} autoComplete="email" placeholder="you@gmail.com" required /></label>
      </div>
      <fieldset className="wl-f">
        <legend>Plan you're interested in</legend>
        <div className="wl-seg">{PLAN_CHOICES.map((c) => <label key={c} className={v.plan === c ? 'on' : ''}><input type="radio" name="wl-plan" value={c} checked={v.plan === c} onChange={set('plan')} />{c}</label>)}</div>
      </fieldset>
      <fieldset className="wl-f">
        <legend>Where are you now?</legend>
        <div className="wl-seg">{STAGE_CHOICES.map((c) => <label key={c} className={v.stage === c ? 'on' : ''}><input type="radio" name="wl-stage" value={c} checked={v.stage === c} onChange={set('stage')} />{c}</label>)}</div>
      </fieldset>
      <label className="wl-f"><span>What do you want most from Pro? <i className="muted">(optional)</i></span><textarea rows={2} value={v.want} onChange={set('want')} placeholder="e.g. projects for my resume, mock interviews" /></label>
      {err && <p className="wl-err" role="alert">{err}</p>}
      <button className="btn btn-primary btn-lg wl-btn" disabled={state === 'sending'}>{state === 'sending' ? 'Adding you…' : 'Join the waitlist'}</button>
      <p className="small muted wl-fine">We only use this to tell you about Pro. See the <Link to="/privacy">privacy note</Link>.</p>
    </form>
  )
}
