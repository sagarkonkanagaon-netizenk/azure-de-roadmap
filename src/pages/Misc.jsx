import { Link } from 'react-router-dom'
import guide from '../content/guide.json'
import { BRAND, CERTS, FREE_PLATFORMS, MANTRAS, FINAL_WORD } from '../data/extras.js'
import { useProgress, toggleIn } from '../lib/progress.js'

const clean = (t) => t.replace(/^\S*\s*Project/, 'Project').replace(/^[^\w]+/, '')

export function Projects() {
  const p = useProgress()
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div className="eyebrow">Portfolio projects</div>
          <h1>Build things you can talk about</h1>
          <p>Six projects that map to what interviewers ask. Build them on Databricks Free Edition and an Azure free account, push the code to GitHub, and write a README that explains each design choice.</p>
        </div>
        <div className="grid g2">
          {guide.projects.map((pr, i) => {
            const id = 'proj' + (i + 1)
            return (
              <div key={pr.title} className="card card-pad">
                <div className="spread"><span className="chip chip-primary">{clean(pr.title).split(' · ')[0]}</span>{p.checks[id] && <span className="chip chip-ok">Built</span>}</div>
                <h2 style={{ margin: '12px 0 6px' }}>{clean(pr.title).split(' · ').slice(1).join(' · ') || clean(pr.title)}</h2>
                <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>{pr.tags.map((t) => <span key={t} className="chip">{t}</span>)}</div>
                <p className="muted small">{pr.why}</p>
                <ol style={{ paddingLeft: '1.2em', margin: '8px 0 12px' }}>{pr.steps.map((s) => <li key={s}>{s}</li>)}</ol>
                <label className="row small"><input type="checkbox" checked={!!p.checks[id]} onChange={() => toggleIn('checks', id)} /> I built this and pushed it to GitHub</label>
              </div>
            )
          })}
        </div>
        <div className="card card-pad" style={{ marginTop: 28 }}>
          <h3>Want worked examples?</h3>
          <p className="muted">The <a href={`${BRAND.github}/spark-pipeline-labs`} target="_blank" rel="noreferrer">spark-pipeline-labs</a> repo has runnable PySpark labs (medallion, SCD Type 2, data quality, streaming) with tests and CI, so you can see what a finished project looks like.</p>
        </div>
      </div>
    </div>
  )
}

function ResCard({ r }) {
  return (
    <a href={r.href} target="_blank" rel="noreferrer" className="card card-pad card-link">
      <b>{r.title}</b>
      {r.by && <div className="small muted" style={{ margin: '4px 0' }}>{r.by}</div>}
      <p className="small" style={{ margin: 0 }}>{r.desc}</p>
    </a>
  )
}

export function Resources() {
  const yt = guide.resources.filter((r) => r.kind === 'yt').map((r) => ({ ...r, by: r.by.replace(/^by\s*/, '').replace(/\s*FREE$/, '') }))
  const paid = guide.resources.filter((r) => r.kind === 'udemy').map((r) => ({ ...r, by: 'Udemy · paid, wait for a sale' }))
  const free = [...FREE_PLATFORMS, { title: 'LeetCode Database problems', href: 'https://leetcode.com/problemset/database/', desc: 'Free-tier SQL problems with a judge, sorted by difficulty.' }]
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div className="eyebrow">Resources</div>
          <h1>The best of the rest, curated</h1>
          <p>You can get job-ready without paying for a course. These are the free videos and platforms worth your time, plus the certifications that matter and when to take them.</p>
        </div>
        <div className="section-head"><h2>Certifications</h2></div>
        <div className="grid g3">
          {CERTS.map((c) => (
            <div key={c.code} className="card card-pad">
              <div className="spread"><span className="chip chip-primary">{c.code}</span><span className="chip">{c.tier}</span></div>
              <h3 style={{ margin: '10px 0 4px' }}>{c.name}</h3>
              <div className="small muted">{c.when}</div>
              <p className="small">{c.why}</p>
            </div>
          ))}
        </div>
        <div className="section-head" style={{ marginTop: 40 }}><h2>Free platforms to practise on</h2></div>
        <div className="grid g3">{free.map((r) => <ResCard key={r.title} r={r} />)}</div>
        <div className="section-head" style={{ marginTop: 40 }}><h2>Free video courses</h2></div>
        <div className="grid g4">{yt.map((r) => <ResCard key={r.title} r={r} />)}</div>
        <div className="section-head" style={{ marginTop: 40 }}><h2>Paid courses, if you want structure</h2><p>Optional. Udemy runs sales most weeks, so never pay full price.</p></div>
        <div className="grid g3">{paid.map((r) => <ResCard key={r.title} r={r} />)}</div>
      </div>
    </div>
  )
}

export function About() {
  return (
    <div className="page">
      <div className="container narrow">
        <div className="page-head">
          <div className="eyebrow">About</div>
          <h1>Why this exists</h1>
          <p>Good data engineering education is expensive, and most of it stops at slides. {BRAND.name} is free, hands-on and built from real production work: you write SQL and Python that actually runs, fix broken pipelines, and practise the interviews.</p>
        </div>
        <div className="card card-pad">
          <h3>Made by {BRAND.author}</h3>
          <p className="muted">{BRAND.authorRole}. I wrote the handbooks, notes and interview material here from years of building and running data platforms.</p>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <a className="btn btn-ghost btn-sm" href={BRAND.portfolio} target="_blank" rel="noreferrer">Portfolio</a>
            <a className="btn btn-ghost btn-sm" href={BRAND.github} target="_blank" rel="noreferrer">GitHub</a>
            <a className="btn btn-ghost btn-sm" href={`mailto:${BRAND.email}`}>Email</a>
          </div>
        </div>
        <h2 style={{ marginTop: 32 }}>Mantras</h2>
        <ul className="ticks">{MANTRAS.map((m) => <li key={m}>{m}</li>)}</ul>
        <div className="note" style={{ marginTop: 24 }}>{FINAL_WORD}</div>
        <div className="row" style={{ marginTop: 20 }}><Link className="btn btn-primary" to="/path">Start the path</Link><Link className="btn btn-ghost" to="/practice/sql">Open the SQL lab</Link></div>
      </div>
    </div>
  )
}

const FREE = ['The full 12-week path and every handbook', 'SQL lab: 78 questions, auto-checked', 'Python lab with auto-checks', 'Incident drills, scenario and PySpark questions', 'Flashcards and progress tracking', 'No account, no ads, no paywall on learning']
const PRO = ['AI mock interviewer that asks follow-ups and scores you', 'Graded capstone reviews on your GitHub projects', 'Shareable certificate of completion', 'Progress sync across devices', 'Early access to the live cohort']

export function Pro() {
  const mail = `mailto:${BRAND.email}?subject=${encodeURIComponent(BRAND.name + ' Pro waitlist')}&body=${encodeURIComponent('Hi, please add me to the Pro waitlist.\n\nWhere I am in my journey: ')}`
  return (
    <div className="page">
      <div className="container">
        <div className="page-head center" style={{ marginInline: 'auto' }}>
          <div className="eyebrow">Pricing</div>
          <h1>Learning is free. Forever.</h1>
          <p>Everything you need to learn data engineering stays free. Pro adds the things that cost money to run: an AI interviewer, human-style reviews and a certificate.</p>
        </div>
        <div className="grid g2" style={{ maxWidth: 860, marginInline: 'auto' }}>
          <div className="card card-pad">
            <span className="chip">Free</span>
            <div className="price">₹0</div>
            <ul className="ticks">{FREE.map((x) => <li key={x}>{x}</li>)}</ul>
            <Link className="btn btn-ghost" to="/path">Start learning</Link>
          </div>
          <div className="card card-pad" style={{ borderColor: 'var(--primary)' }}>
            <div className="spread"><span className="chip chip-primary">Pro</span><span className="chip chip-warn">Coming soon</span></div>
            <div className="price">₹299<small>/month</small></div>
            <div className="small muted">or ₹1,999 a year (save 44%)</div>
            <ul className="ticks">{PRO.map((x) => <li key={x}>{x}</li>)}</ul>
            <a className="btn btn-primary" href={mail}>Join the waitlist</a>
          </div>
        </div>
        <p className="small muted center" style={{ marginTop: 20 }}>Students who can't afford Pro can email for a free pass. Nobody should be priced out of learning.</p>
      </div>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="page">
      <div className="container narrow center">
        <div style={{ fontSize: '3rem' }}>🧭</div>
        <h1>This page fell out of the pipeline</h1>
        <p className="muted">It may have moved. Try the path or search with Ctrl+K.</p>
        <div className="row" style={{ justifyContent: 'center' }}><Link className="btn btn-primary" to="/">Home</Link><Link className="btn btn-ghost" to="/path">The path</Link></div>
      </div>
    </div>
  )
}
