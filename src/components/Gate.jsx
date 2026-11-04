import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AUTH_ENABLED, AUTH_EVENT, mightBeSignedIn } from '../lib/auth.js'
import { isOpen } from '../lib/gate.js'
import HeroMark from './HeroMark.jsx'

export function useSignedIn() {
  const [v, setV] = useState(mightBeSignedIn)
  useEffect(() => {
    const on = () => setV(mightBeSignedIn())
    window.addEventListener(AUTH_EVENT, on); window.addEventListener('storage', on)
    return () => { window.removeEventListener(AUTH_EVENT, on); window.removeEventListener('storage', on) }
  }, [])
  return v
}

export default function Gate({ children }) {
  const { pathname } = useLocation()
  const signedIn = useSignedIn()
  if (!AUTH_ENABLED || signedIn || isOpen(pathname)) return children
  return (
    <div className="page">
      <div className="container narrow">
        <div className="card gate">
          <HeroMark size={84} />
          <div className="eyebrow">Sign in to continue</div>
          <h1>Sign in to keep going</h1>
          <p className="muted">Create an account to open this page. It saves your progress, streak and XP, and works on one device at a time.</p>
          <div className="account-actions">
            <Link className="btn btn-primary btn-lg" to={`/account?next=${encodeURIComponent(pathname)}`}>Create an account</Link>
            <Link className="btn btn-ghost btn-lg" to="/learn">Browse the open chapters</Link>
          </div>
          <p className="small muted">Takes 20 seconds with your email or Google. No password to remember.</p>
        </div>
      </div>
    </div>
  )
}
