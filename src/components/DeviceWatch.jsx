import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { mightBeSignedIn, loadProfile } from '../lib/auth.js'

// Checks every few minutes, and when the tab comes back, that this device is still the account's active one.
export default function DeviceWatch() {
  const [kicked, setKicked] = useState(false)
  useEffect(() => {
    if (!mightBeSignedIn()) return
    let stop = false
    const check = () => loadProfile().then((p) => { if (!stop && p && p.kicked) setKicked(true) }).catch(() => {})
    check()
    const t = setInterval(check, 5 * 60 * 1000)
    const onVis = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVis)
    return () => { stop = true; clearInterval(t); document.removeEventListener('visibilitychange', onVis) }
  }, [])
  if (!kicked) return null
  return (
    <div className="device-kicked" role="status">
      <span>Your account is now signed in on another device, so it was signed out here.</span>
      <Link to="/account" onClick={() => setKicked(false)}>Sign in here</Link>
      <button aria-label="Dismiss" onClick={() => setKicked(false)}>×</button>
    </div>
  )
}
