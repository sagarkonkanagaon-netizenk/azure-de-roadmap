import { Link } from 'react-router-dom'
import Machine from '../components/Machine.jsx'
import booksIndex from '../content/books-index.json'
import sqlQ from '../content/sql-questions.json'
import pyQ from '../content/py-questions.json'
import scen from '../content/scenarios.json'
import { WEEKS, PHASES } from '../data/path.js'
import { DRILLS } from '../data/drills.js'
import { useProgress } from '../lib/progress.js'
import { weekDone } from './Path.jsx'
import { BRAND, MANTRAS } from '../data/extras.js'

const chapters = booksIndex.reduce((a, b) => a + b.chapters.length, 0)
const scenarios = scen.sections.reduce((a, s) => a + s.questions.length, 0)

export default function Home() {
  const p = useProgress()
  const started = Object.keys(p.chapters).length + Object.keys(p.sql).length + Object.keys(p.py).length > 0
  return (
    <>
      <section className="hero">
        <div className="glow" />
        <div className="container hero-grid">
          <div>
            <div className="eyebrow">Free · Hands-on · Built for India first</div>
            <h1>Become a data engineer by <span className="grad">doing the work</span>, not watching it.</h1>
            <p className="lead">A 12-week path from SQL to production pipelines on Azure and Databricks. Run real SQL and Python right here in your browser, fix broken pipelines, and walk into interviews ready. No install. No signup. No fee.</p>
            <div className="hero-cta">
              <Link to={started ? '/progress' : '/path/1'} className="btn btn-primary">{started ? 'Continue where you left off' : 'Start week 1'} →</Link>
              <Link to="/practice/sql/1" className="btn btn-ghost">Try the SQL lab</Link>
            </div>
            <div className="hero-proof">
              <div><b>{chapters}</b>handbook chapters</div>
              <div><b>{sqlQ.questions.length}</b>runnable SQL questions</div>
              <div><b>{pyQ.questions.length + scenarios}</b>more interview questions</div>
              <div><b>₹0</b>to learn everything</div>
            </div>
          </div>
          <Machine />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Why it works</div>
            <h2>Every lesson ends with you doing the thing</h2>
            <p>Courses teach you to recognise answers. Jobs and interviews ask you to produce them. Here you practise the way the work actually happens.</p>
          </div>
          <div className="grid g3">
            <div className="card feature"><div className="ico">⌨️</div><h3>Run it in the browser</h3><p>A real SQL engine (DuckDB) and Python run on this page. Every SQL question has sample data and checks your answer instantly.</p></div>
            <div className="card feature"><div className="ico">🚨</div><h3>Fix broken pipelines</h3><p>Incident drills drop you into a 3 AM page: schema drift, late data, duplicate replays, null storms, outages. Find the bug, ship the fix.</p></div>
            <div className="card feature"><div className="ico">🎯</div><h3>Interview mode</h3><p>{sqlQ.questions.length} SQL, {pyQ.questions.length} Python and PySpark, and {scenarios} scenario questions with the follow-ups interviewers really ask, plus flashcards that repeat what you forget.</p></div>
            <div className="card feature"><div className="ico">📘</div><h3>Four complete handbooks</h3><p>SQL, PySpark, Databricks and Streaming: {chapters} chapters written from production experience, with diagrams, cheat sheets and memory hooks.</p></div>
            <div className="card feature"><div className="ico">🗺️</div><h3>A plan for working people</h3><p>Two hours on weekdays, five on weekends, twelve weeks. Each week has reading, practice, a build task and a checklist.</p></div>
            <div className="card feature"><div className="ico">📈</div><h3>Progress you can see</h3><p>Streaks, a skill map per phase and every question you solved, saved on your device. Export it any time.</p></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="spread" style={{ marginBottom: 18 }}>
            <div className="section-head" style={{ margin: 0 }}>
              <div className="eyebrow">The path</div>
              <h2>Twelve weeks, seven phases</h2>
            </div>
            <Link to="/path" className="btn btn-ghost btn-sm">See the full plan</Link>
          </div>
          <div className="weekstrip">
            {WEEKS.map((w) => {
              const ph = PHASES.find((x) => x.n === w.phase)
              return <Link key={w.n} to={`/path/${w.n}`} className={weekDone(w, p) ? 'done' : ''} style={{ borderTop: `3px solid ${ph.color}` }} title={w.title}>W{w.n}<small>{ph.title.split(' ')[0]}</small></Link>
            })}
          </div>
          <div className="grid g4" style={{ marginTop: 18 }}>
            {PHASES.slice(0, 4).concat(PHASES.slice(4)).map((ph) => (
              <div key={ph.n} className="card card-pad" style={{ borderLeft: `4px solid ${ph.color}` }}>
                <div className="small muted">Phase {ph.n} · weeks {ph.weeks}</div>
                <b>{ph.title}</b>
              </div>
            ))}
            <Link to="/drills" className="card card-pad card-link" style={{ borderLeft: '4px solid var(--danger)' }}>
              <div className="small muted">Alongside every phase</div>
              <b>{DRILLS.length} incident drills →</b>
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">Learn</div>
            <h2>The handbooks</h2>
          </div>
          <div className="grid g4">
            {booksIndex.map((b) => (
              <Link key={b.slug} to={`/learn/${b.slug}`} className="card card-pad card-link">
                <div className="chip chip-primary" style={{ marginBottom: 10 }}>{b.chapters.length} chapters · {Math.round(b.minutes / 60)} h</div>
                <h3>{b.title}</h3>
                <p className="muted small" style={{ margin: 0 }}>{b.subtitle}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="cta-band">
            <div className="grid g2" style={{ alignItems: 'center' }}>
              <div>
                <div className="eyebrow" style={{ color: '#5eead4' }}>Education should be cheap</div>
                <h2 style={{ color: '#fff' }}>Bootcamps here cost ₹20,000 to ₹2,50,000. Everything on this site is free.</h2>
                <p>Pro, coming soon, adds an AI mock interviewer, graded capstone reviews and a certificate for less than the price of a pizza a month. Learning never goes behind a paywall.</p>
                <div className="row"><Link to="/path/1" className="btn btn-primary">Start free</Link><Link to="/pro" className="btn btn-ghost">What Pro adds</Link></div>
              </div>
              <div className="quote" style={{ color: '#e8edf6' }}>
                “{MANTRAS[2]}”
                <div className="small" style={{ color: '#94a3b8', marginTop: 10, fontFamily: 'var(--font)' }}>— {BRAND.author}</div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
