import { useState } from 'react'
import { Link } from 'react-router-dom'
import Mission, { Onboarding, getProfile, startWeek } from '../components/Mission.jsx'
import DailyBanner from '../components/DailyBanner.jsx'
import Console from '../components/Console.jsx'
import HeroMark from '../components/HeroMark.jsx'
import { AUTH_ENABLED } from '../lib/auth.js'
import books from '../content/books-index.json'
import { WEEKS, PHASES } from '../data/path.js'
import { useProgress } from '../lib/progress.js'
import { PRO_PRICE, PRO_PROJECT_COUNT } from '../data/pro.js'
import { weekDone } from './Path.jsx'
import { JOURNEY } from '../data/journey.js'

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


const CHAPTERS = books.reduce((a, b) => a + b.chapters.length, 0)
const STATS = [
  ['24', 'weeks, step by step'],
  [CHAPTERS, 'handbook chapters'],
  [__QUESTION_COUNTS__.sql, 'SQL interview problems'],
  [__QUESTION_COUNTS__.py, 'Python and PySpark problems'],
  ['2.6M', 'rows to practise on'],
]
const STACK = ['SQL', 'Python', 'PySpark', 'Spark internals', 'Databricks', 'Delta Lake', 'Unity Catalog', 'Azure Data Factory', 'ADLS Gen2', 'Kafka', 'Structured Streaming', 'CDC', 'Data modelling', 'SCD Type 2', 'Data quality', 'CI/CD', 'Docker', 'System design', 'Interviews']

const COMPARE = [
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
  const built = Object.keys(p.checks || {}).filter((k) => /^proj\d+$/.test(k) && p.checks[k]).length
  const journeyStat = [
    `${Math.min(Object.keys(p.chapters).length, CHAPTERS)} of ${CHAPTERS} chapters read`,
    `${[...Object.values(p.sql), ...Object.values(p.py)].filter((v) => v === 'solved').length} problems solved`,
    `${built} ${built === 1 ? 'project' : 'projects'} built`,
  ]
  return (
    <>
      <section className="hero3">
        <div className="container hero3-grid">
          <div className="hero3-copy">
            <div className="hero-brand"><HeroMark /><div className="hero-brand-txt"><p className="hero-tagline">On your highway <em>to get hired</em></p><span className="pill-note">Works in your browser · No setup</span></div></div>
            <h1>Learn data engineering <em>by doing it.</em></h1>
            <p className="lead">The complete course, from your first SQL query to Spark, Databricks, the cloud and streaming. Practise on millions of rows right in your browser, and walk into interviews ready.</p>
            <div className="hero-cta">
              {returning
                ? <Link to={`/path/${startWeek(profile)}`} className="btn btn-primary btn-lg">Continue learning</Link>
                : <button className="btn btn-primary btn-lg" onClick={() => setOnboard(true)}>Start learning</button>}
              <button className="btn btn-ghost btn-lg" onClick={() => document.getElementById('try')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Try a SQL query</button>
            </div>
            <p className="hero-note">Real SQL and Python · Runs on your phone or laptop</p>
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
            <h2 className="journey-name">{JOURNEY.name}</h2>
            <p>{JOURNEY.tagline}</p>
          </div>
          <ol className="how journey">
            {JOURNEY.steps.map((s, i) => (
              <li key={s.word} className="how-step">
                <span className="how-n" aria-hidden="true">{i + 1}</span>
                <h3>{s.word}{s.gloss && <> <span className="journey-gloss">{s.gloss}</span></>}</h3>
                <p>{s.body}</p>
                {started && <p className="journey-stat">{journeyStat[i]}</p>}
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
              <span className="basic-k">The course</span>
              <h3>Everything you need to learn</h3>
              <ul className="ticks">
                <li>The full 24-week path and five handbooks</li>
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
                <Link to="/pro/projects/food-delivery-lakehouse" className="btn btn-ghost">Preview project 1</Link>
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
