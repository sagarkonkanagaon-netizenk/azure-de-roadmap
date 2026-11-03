import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Mission, { Onboarding, getProfile, startWeek } from '../components/Mission.jsx'
import DailyBanner from '../components/DailyBanner.jsx'
import Console from '../components/Console.jsx'
import booksIndex from '../content/books-index.json'
import sqlQ from '../content/sql-questions.json'
import pyQ from '../content/py-questions.json'
import scen from '../content/scenarios.json'
import { WEEKS, PHASES } from '../data/path.js'
import { QUIZ } from '../data/quiz.js'
import { useProgress } from '../lib/progress.js'
import { weekDone } from './Path.jsx'
import { BRAND, MANTRAS } from '../data/extras.js'
import { SECTIONS } from '../data/sections.js'
import { SectionArt, DataRain } from '../components/DataArt.jsx'

const chapters = booksIndex.reduce((a, b) => a + b.chapters.length, 0)
const scenarios = scen.sections.reduce((a, s) => a + s.questions.length, 0)
const COST = [['Live bootcamps', '₹60,000 – ₹2,50,000'], ['Self-paced platforms', '₹15,000 – ₹20,000 / yr'], ['Zero to Hero', '₹0']]

function Count({ to }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(to); return }
    let raf, t0
    const step = (t) => { t0 ??= t; const k = Math.min(1, (t - t0) / 1400); setV(Math.round(to * (1 - Math.pow(1 - k, 3)))); if (k < 1) raf = requestAnimationFrame(step) }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [to])
  return v
}

function greet() {
  const h = new Date().getHours()
  return h < 5 ? 'Up late?' : h < 12 ? 'Good morning!' : h < 17 ? 'Good afternoon!' : 'Good evening!'
}

export default function Home() {
  const p = useProgress()
  const started = Object.keys(p.chapters).length + Object.keys(p.sql).length + Object.keys(p.py).length + Object.keys(p.drills).length > 0
  const [onboard, setOnboard] = useState(false)
  const profile = getProfile()
  const doneWeeks = WEEKS.filter((w) => weekDone(w, p)).length
    const STAT = {
    learn: `${chapters} chapters · ${Object.keys(p.chapters).length} read`,
    practice: `${sqlQ.questions.length + pyQ.questions.length} problems · ${Object.values(p.sql).filter((v) => v === 'solved').length + Object.values(p.py).filter((v) => v === 'solved').length} solved`,
    interview: `${QUIZ.length} quiz questions · ${scenarios} scenarios`,
  }
  return (
    <>
      <section className="hero2">
        <div className="hero-grid-bg" aria-hidden="true" />
        <DataRain />
        <div className="container hero2-grid">
          <div className="hero2-copy">
            <div className="hello"><span className="wave" aria-hidden="true">👋</span>{greet()} Free forever · no signup</div>
            <h1>Become a data engineer <em>by shipping</em> real pipelines.</h1>
            <p className="lead">The full path from SQL to production lakehouses on Azure and Databricks. You write real SQL and Python in the browser, fix broken pipelines from a 3 AM page, and practise the interviews that decide offers.</p>
            <div className="hero-cta">
              {started || profile
                ? <Link to={`/path/${startWeek(profile)}`} className="btn btn-primary">Continue my path <span aria-hidden="true">→</span></Link>
                : <button className="btn btn-primary" onClick={() => setOnboard(true)}>Find my starting point <span aria-hidden="true">→</span></button>}
              <Link to="/playground" className="btn btn-ghost">Run any SQL now</Link>
            </div>
            <dl className="ticker">
              <div><dt>Chapters</dt><dd className="glow-num"><Count to={chapters} /></dd></div>
              <div><dt>Runnable SQL</dt><dd className="glow-num"><Count to={sqlQ.questions.length} /></dd></div>
              <div><dt>Interview Qs</dt><dd className="glow-num"><Count to={pyQ.questions.length + scenarios + QUIZ.length} /></dd></div>
              <div><dt>Cost</dt><dd className="glow-num">₹0</dd></div>
            </dl>
          </div>
          <Console />
        </div>
      </section>

      {onboard && <Onboarding onClose={() => setOnboard(false)} />}
      {(started || profile) && <Mission />}
      <DailyBanner />

      <section className="section steps-sec">
        <div className="container">
          <div className="section-head center">
            <div className="eyebrow">How it works</div>
            <h2>Three steps. <em>One</em> habit.</h2>
            <p>Read a little, do a lot, then prove it. Every part of the site sits in one of these three places.</p>
          </div>
          <div className="steps">
            {SECTIONS.filter((x) => x.id !== 'daily').map((sec, i) => (
              <div key={sec.id} className="step card" data-sec={sec.id}>
                <div className="step-top"><span className="step-n">0{i + 1}</span><span className="step-ico" aria-hidden="true"><SectionArt id={sec.id} size={46} /></span></div>
                <div className="step-k">{sec.blurb}</div>
                <h3>{sec.label}</h3>
                <p>{sec.lead}</p>
                <div className="step-links">
                  {sec.items.slice(0, 4).map((it) => <Link key={it.to} to={it.to}><span aria-hidden="true">{it.icon}</span>{it.label}<i aria-hidden="true">→</i></Link>)}
                </div>
                <div className="step-stat">{STAT[sec.id]}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="spread" style={{ alignItems: 'flex-end', marginBottom: 22 }}>
            <div className="section-head" style={{ margin: 0 }}>
              <div className="eyebrow">The path · {doneWeeks}/12 weeks done</div>
              <h2>Twelve weeks. <em>Seven</em> phases.</h2>
              <p>Built for people with a job: two hours on weekdays, five on weekends. Each week has reading, practice, a build task and a checklist.</p>
            </div>
            <Link to="/path" className="btn btn-ghost btn-sm">See the full plan →</Link>
          </div>
          <ol className="timeline">
            {PHASES.map((ph) => (
              <li key={ph.n} style={{ '--c': ph.color }}>
                <span className="tl-n">0{ph.n}</span>
                <b>{ph.title}</b>
                <span className="tl-w">Weeks {ph.weeks}</span>
              </li>
            ))}
          </ol>
          <div className="weekstrip" style={{ marginTop: 18 }}>
            {WEEKS.map((w) => {
              const ph = PHASES.find((x) => x.n === w.phase)
              return <Link key={w.n} to={`/path/${w.n}`} className={weekDone(w, p) ? 'done' : ''} style={{ '--c': ph.color }} title={w.title}>W{String(w.n).padStart(2, '0')}</Link>
            })}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="price-band">
            <div>
              <div className="eyebrow">Education should be cheap</div>
              <h2>Learning stays free. <em>Always.</em></h2>
              <p>Pro, coming soon, adds an AI mock interviewer, graded capstone reviews and a certificate for ₹299 a month. Nothing you need to learn ever goes behind a paywall.</p>
              <div className="row"><Link to="/path/1" className="btn btn-primary">Start free</Link><Link to="/pro" className="btn btn-ghost">What Pro adds</Link></div>
            </div>
            <div className="cost">
              {COST.map(([k, v], i) => (
                <div key={k} className={'cost-row' + (i === COST.length - 1 ? ' us' : '')}><span>{k}</span><b>{v}</b></div>
              ))}
              <figure className="quote">
                “{MANTRAS[2]}”
                <figcaption>{BRAND.author}</figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
