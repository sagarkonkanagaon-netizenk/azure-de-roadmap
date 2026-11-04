import { useState } from 'react'
import { Link } from 'react-router-dom'
import Mission, { Onboarding, getProfile, startWeek } from '../components/Mission.jsx'
import DailyBanner from '../components/DailyBanner.jsx'
import Console from '../components/Console.jsx'
import HeroMark from '../components/HeroMark.jsx'
import sqlQ from '../content/sql-questions.json'
import { WEEKS, PHASES } from '../data/path.js'
import { useProgress } from '../lib/progress.js'
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
            <div className="hero-brand"><HeroMark /><div className="hero-brand-txt"><p className="hero-tagline">On your highway <em>to get hired</em></p><span className="pill-note">Free · No signup · Works in your browser</span></div></div>
            <h1>Learn data engineering <em>by doing it.</em></h1>
            <p className="lead">A 24-week path, about five and a half months, from your first SQL query to real pipelines on the cloud. Read a little, practise a lot, and get ready for interviews.</p>
            <div className="hero-cta">
              {returning
                ? <Link to={`/path/${startWeek(profile)}`} className="btn btn-primary btn-lg">Continue learning</Link>
                : <button className="btn btn-primary btn-lg" onClick={() => setOnboard(true)}>Start learning free</button>}
              <button className="btn btn-ghost btn-lg" onClick={() => document.getElementById('try')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Try a SQL query</button>
            </div>
            <p className="hero-note">{sqlQ.questions.length} SQL problems · 4 handbooks · 2.6M rows to explore</p>
          </div>
          <div id="try" className="hero3-try">
            <Console />
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
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="spread path-head">
            <div className="section-head" style={{ margin: 0 }}>
              <div className="eyebrow">The 24-week path · {doneWeeks}/{WEEKS.length} done</div>
              <h2>Seven phases, one week at a time</h2>
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
              <span className="basic-k">Pro · coming soon · ₹299/month</span>
              <h3>Extra help to get hired</h3>
              <ul className="ticks">
                <li>AI mock interviewer</li>
                <li>Reviews of your capstone project</li>
                <li>A certificate you can share</li>
              </ul>
              <Link to="/pro" className="btn btn-ghost">Join the waitlist</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
