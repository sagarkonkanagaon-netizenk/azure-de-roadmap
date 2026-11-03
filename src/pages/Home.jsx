import { useState } from 'react'
import { Link } from 'react-router-dom'
import Mission, { Onboarding, getProfile, startWeek } from '../components/Mission.jsx'
import DailyBanner from '../components/DailyBanner.jsx'
import Machine from '../components/Machine.jsx'
import Console from '../components/Console.jsx'
import booksIndex from '../content/books-index.json'
import sqlQ from '../content/sql-questions.json'
import pyQ from '../content/py-questions.json'
import scen from '../content/scenarios.json'
import { WEEKS, PHASES } from '../data/path.js'
import { DRILLS } from '../data/drills.js'
import { QUIZ } from '../data/quiz.js'
import { useProgress } from '../lib/progress.js'
import { weekDone } from './Path.jsx'
import { BRAND, MANTRAS } from '../data/extras.js'

const chapters = booksIndex.reduce((a, b) => a + b.chapters.length, 0)
const scenarios = scen.sections.reduce((a, s) => a + s.questions.length, 0)
const TOPICS = ['SQL', 'Window functions', 'PySpark', 'Spark internals', 'Delta Lake', 'Databricks', 'Unity Catalog', 'Azure Data Factory', 'ADLS Gen2', 'Medallion', 'SCD Type 2', 'Streaming', 'Kafka', 'Watermarks', 'Airflow', 'Data quality', 'CI/CD', 'Data modeling', 'Interviews']
const SPINES = { sql: 'var(--bronze)', spark: 'var(--primary)', lake: 'var(--accent)', stream: 'var(--silver)' }
const COST = [['Live bootcamps', '₹60,000 – ₹2,50,000'], ['Self-paced platforms', '₹15,000 – ₹20,000 / yr'], ['Zero to Hero', '₹0']]

export default function Home() {
  const p = useProgress()
  const started = Object.keys(p.chapters).length + Object.keys(p.sql).length + Object.keys(p.py).length + Object.keys(p.drills).length > 0
  const [onboard, setOnboard] = useState(false)
  const profile = getProfile()
  const doneWeeks = WEEKS.filter((w) => weekDone(w, p)).length
  const drill = DRILLS[0]
  const sample = QUIZ.find((x) => x.id === 'sql7')
  return (
    <>
      <section className="hero2">
        <div className="hero-grid-bg" aria-hidden="true" />
        <div className="container hero2-grid">
          <div className="hero2-copy">
            <div className="eyebrow">Free forever · 12 weeks · no signup</div>
            <h1>Become a data engineer <em>by shipping</em> real pipelines.</h1>
            <p className="lead">The full path from SQL to production lakehouses on Azure and Databricks. You write real SQL and Python in the browser, fix broken pipelines from a 3 AM page, and practise the interviews that decide offers.</p>
            <div className="hero-cta">
              {started || profile
                ? <Link to={`/path/${startWeek(profile)}`} className="btn btn-primary">Continue my path <span aria-hidden="true">→</span></Link>
                : <button className="btn btn-primary" onClick={() => setOnboard(true)}>Find my starting point <span aria-hidden="true">→</span></button>}
              <Link to="/playground" className="btn btn-ghost">Run any SQL now</Link>
            </div>
            <dl className="ticker">
              <div><dt>Chapters</dt><dd>{chapters}</dd></div>
              <div><dt>Runnable SQL</dt><dd>{sqlQ.questions.length}</dd></div>
              <div><dt>Interview Qs</dt><dd>{pyQ.questions.length + scenarios + QUIZ.length}</dd></div>
              <div><dt>Cost</dt><dd>₹0</dd></div>
            </dl>
          </div>
          <Console />
        </div>
      </section>

      {onboard && <Onboarding onClose={() => setOnboard(false)} />}
      {(started || profile) && <Mission />}
      <DailyBanner />

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...TOPICS, ...TOPICS].map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>

      <section className="section">
        <div className="container">
          <div className="section-head">
            <div className="eyebrow">What's inside</div>
            <h2>Everything between <em>zero</em> and your first offer.</h2>
            <p>Courses teach you to recognise answers. Jobs ask you to produce them. Every part of this site ends with you doing the work.</p>
          </div>
          <div className="bento">
            <Link to="/practice/sql" className="tile tile-sql card-link">
              <div className="tile-k">SQL lab</div>
              <h3>{sqlQ.questions.length} interview questions on a real engine</h3>
              <p>DuckDB runs on the page. Write the query, press Check, and see exactly which rows differ.</p>
              <pre className="mini-code"><b>WITH</b> ranked <b>AS</b> (<br />  <b>SELECT</b> *, <b>ROW_NUMBER</b>() <b>OVER</b> (<br />    <b>PARTITION BY</b> order_id<br />    <b>ORDER BY</b> updated_at <b>DESC</b>) rn<br />  <b>FROM</b> orders)<br /><b>SELECT</b> * <b>FROM</b> ranked <b>WHERE</b> rn = 1;</pre>
            </Link>
            <Link to={`/drills/${drill.id}`} className="tile tile-drill card-link">
              <div className="tile-k" style={{ color: 'var(--danger)' }}>● Incident drill</div>
              <div className="pager-mini"><b>03:12</b> {drill.pager}</div>
              <h3>Fix the broken pipeline</h3>
              <p>{DRILLS.length} drills from real failures: schema drift, replayed duplicates, late data, null storms, outages.</p>
            </Link>
            <Link to="/interview/quiz" className="tile tile-quiz card-link">
              <div className="tile-k">Quiz · {QUIZ.length} questions</div>
              <h3>{sample.q}</h3>
              <ul className="quiz-mini">{sample.a.slice(0, 3).map((o, i) => <li key={i}><span>{'ABC'[i]}</span>{o}</li>)}</ul>
              <p className="small muted" style={{ margin: 0 }}>Every wrong option is a mistake real candidates make.</p>
            </Link>
            <Link to="/learn" className="tile tile-books card-link">
              <div className="tile-k">Handbooks</div>
              <h3>Four books, {chapters} chapters, written from production work</h3>
              <div className="spines">
                {booksIndex.map((b) => <span key={b.slug} style={{ '--c': SPINES[b.icon] }}><i>{b.title.replace(/ Handbook.*/, '')}</i></span>)}
              </div>
            </Link>
            <Link to="/practice/python" className="tile tile-py card-link">
              <div className="tile-k">Python lab</div>
              <h3>Python in a Web Worker</h3>
              <p>Interview problems with auto-checks, plus {pyQ.questions.filter((q) => q.section === 'PySpark').length} PySpark questions to reason through.</p>
            </Link>
            <Link to="/interview/flashcards" className="tile tile-flash card-link">
              <div className="tile-k">Flashcards</div>
              <h3>Five minutes a day</h3>
              <p>Spaced repetition brings back what you are about to forget.</p>
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="flow-sec">
            <div>
              <div className="eyebrow">How the work flows</div>
              <h2>Raw data in. <em>Trusted</em> data out.</h2>
              <p className="muted">Every phase of the path builds one part of this machine: ingest with Data Factory, land in bronze, clean and conform in silver, model in gold, and keep it running with orchestration, quality checks and CI/CD.</p>
              <ul className="legend">
                <li><span style={{ background: 'var(--bronze)' }} />Bronze: raw and append-only, replayable</li>
                <li><span style={{ background: 'var(--silver)' }} />Silver: deduplicated, typed, conformed</li>
                <li><span style={{ background: 'var(--gold)' }} />Gold: modelled for BI and ML</li>
                <li><span style={{ background: 'var(--danger)' }} />Quarantine: bad rows, held for review</li>
              </ul>
            </div>
            <Machine />
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
