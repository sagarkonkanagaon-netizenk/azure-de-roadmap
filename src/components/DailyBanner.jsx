import { Link } from 'react-router-dom'
import { dayKey, dayNumber, challengeFor } from '../data/daily.js'
import { useProgress } from '../lib/progress.js'

// Home-page strip that points at today's daily SQL challenge.
export default function DailyBanner() {
  const p = useProgress()
  const n = dayNumber()
  const c = challengeFor(n)
  const r = p.checks['daily:' + dayKey()]
  return (
    <section className="daily-banner-sec">
      <div className="container">
        <Link to="/daily" className="daily-banner card">
          <span className="db-badge">Daily SQL<b>#{n}</b></span>
          <span className="db-body">
            <span className="tile-k">{r?.solved ? 'Solved today ✓' : "Today's challenge"} · {c.level}</span>
            <b>{c.title}</b>
            <span className="small muted">{c.prompt}</span>
          </span>
          <span className="btn btn-primary btn-sm db-cta">{r?.solved ? 'Share my result' : 'Solve it'} →</span>
        </Link>
      </div>
    </section>
  )
}
