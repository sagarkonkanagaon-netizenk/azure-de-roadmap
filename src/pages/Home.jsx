import { useState } from 'react'
import { Link } from 'react-router-dom'
import Mission, { Onboarding, getProfile, startWeek } from '../components/Mission.jsx'
import DailyBanner from '../components/DailyBanner.jsx'
import Console from '../components/Console.jsx'
import HeroMark from '../components/HeroMark.jsx'
import { AUTH_ENABLED } from '../lib/auth.js'
import sqlQ from '../content/sql-questions.json'
import books from '../content/books-index.json'
import { WEEKS, PHASES } from '../data/path.js'
import { useProgress } from '../lib/progress.js'
import { PRO_PRICE, PRO_PROJECT_COUNT } from '../data/pro.js'
import { weekDone } from './Path.jsx'

// The basics, explained before any feature is shown.
const BASICS = [
  {
    k: 'The job',
    title: 'What does a data engineer do?',
    body: 'Every app, shop and bank produces data all day. A data engineer builds the pipelines that collect it, clean it and put it in one place, so analysts and dashboards can trust the numbers.',
    eg: 'Orders from an app → cleaned table → a sales dashboard by 9 AM.',
  },
  {
    k: 'The scale',
    title: 'What is big data?',
    body: 'It is data too large for one laptop or one spreadsheet: millions or billions of rows arriving every day. You need tools like SQL engines and Spark that split the work across many machines.',
    eg: 'Our Playground lets you query 2.6 million rows right in your browser.',
  },
  {
    k: 'The payoff',
    title: 'Why learn it?',
    body: 'Every company that uses data needs people who can move it reliably. The core skills (SQL, Python, Spark and the cloud) stay useful for years, and you can learn them without paying for a bootcamp.',
    eg: 'Start with SQL. Most data engineering interviews begin there.',
  },
]

const STEPS = [
  { n: 1, title: 'Learn', body: 'Follow the 24-week path. Each week is a ticket from your lead, with short reading, daily practice and a build.', to: '/learn', cta: 'Open Learn' },
  { n: 2, title: 'Practise', body: 'Write real SQL and Python in the browser. Answers are checked instantly, no setup needed.', to: '/practice', cta: 'Open Practice' },
  { n: 3, title: 'Get hired', body: 'Quizzes, flashcards and model answers for the questions interviewers actually ask.', to: '/interview', cta: 'Open Interview' },
]

const CHAPTERS = books.reduce((a, b) => a + b.chapters.length, 0)
const STATS = [
  ['₹0', 'to learn everything'],
  ['24', 'weeks, step by step'],
  [CHAPTERS, 'handbook chapters'],
  [sqlQ.questions.length, 'SQL interview problems'],
  ['2.6M', 'rows to practise on'],
]
const STACK = ['SQL', 'Python', 'PySpark', 'Spark internals', 'Databricks', 'Delta Lake', 'Unity Catalog', 'Azure Data Factory', 'ADLS Gen2', 'Kafka', 'Structured Streaming', 'CDC', 'Data modelling', 'SCD Type 2', 'Data quality', 'CI/CD', 'Docker', 'System design', 'Interviews']

const COMPARE = [
  ['Price', '₹20,000 to ₹90,000', '₹0. Pro from ₹999 for 6 months'],
  ['Practice', 'Watch videos, set up tools yourself', 'Run every example in your browser'],
  ['Pace', 'Fixed batches and timings', 'Your pace, 2 hours a day'],
  ['Interview prep', 'At the end of the course', 'In every chapter, with quizzes'],
  ['Projects', 'One shared capstone', 'Realistic tickets every week'],
]

export default function Home() {
  const p = useProgress()
  const started = Object.keys(p.chapters).length + Object.keys(p.sql).length + Object.keys(p.py).length + Object.keys(p.drills).length > 0
  const [onboard, setOnboard] = useState(false)
  const profile = getProfile()
  const returning = started || profile
  const doneWeeks = WEEKS.filter((w) => weekDone(w, p)).length
  return (
    <>
      <section className="hero3">
        <div className="container hero3-grid">
          <div className="hero3-copy">
            <div className="hero-brand"><HeroMark /><div className="hero-brand-txt"><p className="hero-tagline">On your highway <em>to get hired</em></p><span className="pill-note">{AUTH_ENABLED ? 'Free account · Works in your browser' : 'Free · No signup · Works in your browser'}</span></div></div>
            <h1>Become a data engineer. <em>For free.</em></h1>
            <p className="lead">The complete course, from your first SQL query to Spark, Databricks, the cloud and streaming. Practise on millions of rows right in your browser, and walk into interviews ready.</p>
            <div className="hero-cta">
              {returning
                ? <Link to={`/path/${startWeek(profile)}`} className="btn btn-primary btn-lg">Continue learning</Link>
                : <button className="btn btn-primary btn-lg" onClick={() => setOnboard(true)}>Start learning free</button>}
              <button className="btn btn-ghost btn-lg" onClick={() => document.getElementById('try')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Try a SQL query</button>
            </div>
            <p className="hero-note">{AUTH_ENABLED ? 'Free forever · No setup · Works on your phone' : 'No signup · No setup · Works on your phone'}</p>
          </div>
          <div id="try" className="hero3-try">
            <Console />
          </div>
        </div>
      </section>

      <section className="stats-band" aria-label="Data Dhaba in numbers">
        <div className="container stats">
          {STATS.map(([n, l]) => <div key={l} className="stat"><b>{n}</b><span>{l}</span></div>)}
        </div>
        <div className="marquee" aria-label="Skills you learn">
          <div className="marquee-track">
            {[...STACK, ...STACK].map((t, i) => <span key={i} aria-hidden={i >= STACK.length}>{t}</span>)}
          </div>
        </div>
      </section>

      {onboard && <Onboarding onClose={() => setOnboard(false)} />}
      {returning && <Mission />}

      <section className="section">
        <div className="container">
          <div className="section-head center">
            <div className="eyebrow">New here? Start with the basics</div>
            <h2>Data engineering in three questions</h2>
            <p>No jargon. If you can use a spreadsheet, you can start.</p>
          </div>
          <div className="basics">
            {BASICS.map((b) => (
              <article key={b.k} className="card basic">
                <span className="basic-k">{b.k}</span>
                <h3>{b.title}</h3>
                <p>{b.body}</p>
                <p className="basic-eg">{b.eg}</p>
              </article>
            ))}
          </div>
          <p className="swipe-hint" aria-hidden="true">Swipe for more →</p>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head center">
            <div className="eyebrow">How it works</div>
            <h2>Three steps, in order</h2>
          </div>
          <ol className="how">
            {STEPS.map((s) => (
              <li key={s.n} className="how-step">
                <span className="how-n" aria-hidden="true">{s.n}</span>
                <h3>{s.title}</h3>
                <p>{s.body}</p>
                <Link to={s.to} className="how-link">{s.cta} →</Link>
              </li>
            ))}
          </ol>
          <p className="swipe-hint" aria-hidden="true">Swipe for more →</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="spread path-head">
            <div className="section-head" style={{ margin: 0 }}>
              <div className="eyebrow">The 24-week path · {doneWeeks}/{WEEKS.length} done</div>
              <h2>{PHASES.length} stops, one week at a time</h2>
              <p>About two hours on weekdays and five at weekends.</p>
            </div>
            <Link to="/path" className="btn btn-ghost btn-sm">See the full plan</Link>
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
        </div>
      </section>

      <DailyBanner />

      <section className="section">
        <div className="container">
          <div className="plans">
            <div className="plan card">
              <span className="basic-k">Free, forever</span>
              <h3>Everything you need to learn</h3>
              <ul className="ticks">
                <li>The full 24-week path and four handbooks</li>
                <li>SQL Lab, Python Lab and the 2.6M-row Playground</li>
                <li>Daily challenge, quizzes and flashcards</li>
              </ul>
              <Link to="/path/1" className="btn btn-primary">Start week 1</Link>
            </div>
            <div className="plan card plan-pro">
              <span className="basic-k">Pro · coming soon · from {PRO_PRICE.amount} for 6 months</span>
              <h3>Everything to get hired</h3>
              <ul className="ticks">
                <li>{PRO_PROJECT_COUNT} end-to-end portfolio projects</li>
                <li>60+ cheat sheets and 500+ interview answers</li>
                <li>AI mock interviewer and system design cases</li>
              </ul>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <Link to="/pro" className="btn btn-ghost">See what's inside</Link>
                <Link to="/pro/projects/food-delivery-lakehouse" className="btn btn-ghost">Try project 1 free</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section section-alt">
        <div className="container">
          <div className="section-head center">
            <div className="eyebrow">Why Data Dhaba</div>
            <h2>Bootcamp depth, without the bootcamp bill</h2>
          </div>
          <div className="compare card" role="table" aria-label="Typical paid course compared with Data Dhaba">
            <div className="compare-row compare-head" role="row"><span role="columnheader" /><span role="columnheader">Typical paid course</span><span role="columnheader">Data Dhaba</span></div>
            {COMPARE.map(([k, a, b]) => (
              <div key={k} className="compare-row" role="row"><span role="rowheader">{k}</span><span role="cell">{a}</span><span role="cell"><i aria-hidden="true">✓</i>{b}</span></div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-band">
        <div className="container cta-inner">
          <div>
            <h2>Your first query is ten seconds away.</h2>
            <p>Open the Playground, run a query on a million orders, and see why companies hire for this.</p>
          </div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Link to="/path/1" className="btn btn-primary btn-lg">Start week 1</Link>
            <Link to="/playground" className="btn btn-on-dark btn-lg">Open the Playground</Link>
          </div>
        </div>
      </section>
    </>
  )
}
