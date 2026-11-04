import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import Markdown from '../components/Markdown.jsx'
import { PROJECT, steps, README, TALKING, RESUME } from '../pro/project-lakehouse.js'
import { useProgress, toggleIn } from '../lib/progress.js'
import { makeTar, saveBlob } from '../lib/tar.js'
import { PRO_PROJECT_COUNT } from '../data/pro.js'

const FLOW = [
  ['Raw files', 'JSON and CSV in a volume'],
  ['Bronze', 'Auto Loader, as-is'],
  ['Silver', 'Typed, deduplicated, SCD2'],
  ['Gold', 'Revenue and on-time by city'],
  ['Checks', 'Fail the job on bad data'],
]
const kb = (n) => (n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB')

export default function ProProject() {
  const p = useProgress()
  const [data, setData] = useState(null)
  useEffect(() => {
    // the generator takes a moment, so let the page paint first
    let live = true
    const t = setTimeout(() => import('../pro/rasoirun-data.js').then((m) => { if (live) setData(m.buildRasoiRun()) }), 30)
    return () => { live = false; clearTimeout(t) }
  }, [])
  const E = data?.expected
  const list = useMemo(() => steps(E || new Proxy({}, { get: () => '…' })), [E])
  const key = (id) => `pro1:${id}`
  const done = list.filter((s) => p.checks[key(s.id)]).length
  const saveAll = () => data && saveBlob(makeTar(Object.fromEntries(Object.entries(data.files).map(([k, v]) => ['rasoirun-raw/' + k, v]))), 'rasoirun-raw.tar')
  const saveOne = (k) => saveBlob(new Blob([data.files[k]], { type: k.endsWith('.csv') ? 'text/csv' : 'application/json' }), k.split('/').pop())

  return (
    <div className="page proj">
      <div className="container">
        <Link to="/pro" className="small">← Data Dhaba Pro</Link>
        <div className="proj-head">
          <div className="eyebrow">Pro project {PROJECT.n} of {PRO_PROJECT_COUNT} <span className="chip chip-ok">Preview</span></div>
          <h1>{PROJECT.title}</h1>
          <p className="lead">{PROJECT.sub}. A real brief, messy data, a step-by-step build with full solutions, and a README ready for your GitHub.</p>
          <div className="row proj-meta">
            <span className="chip">⏱ {PROJECT.hours}</span>
            <span className="chip">{PROJECT.level}</span>
            <span className="chip">Free tools only</span>
          </div>
          <div className="chips">{PROJECT.stack.map((s) => <span key={s} className="chip chip-primary">{s}</span>)}</div>
        </div>

        <div className="ticket" style={{ '--c': 'var(--primary)' }}>
          <span className="ticket-k">Ticket from your lead at RasoiRun</span>
          <Markdown md={PROJECT.brief} className="prose ticket-md" />
        </div>

        <div className="proj-grid">
          <section>
            <h2 className="ds-h">What you'll build</h2>
            <ol className="flow">{FLOW.map(([t, d], i) => <li key={t}><b>{t}</b><span>{d}</span>{i < FLOW.length - 1 && <i aria-hidden="true">→</i>}</li>)}</ol>
            <ul className="ticks">{PROJECT.outcomes.map((o) => <li key={o}>{o}</li>)}</ul>
          </section>
          <aside className="card card-pad proj-data">
            <h3>Download the data</h3>
            <p className="small muted">Six files: three days of order events, two restaurant snapshots and deliveries. They're the same for everyone, so your numbers can match the checkpoints.</p>
            <button className="btn btn-primary" onClick={saveAll} disabled={!data}>{data ? 'Download all (.tar)' : 'Preparing data…'}</button>
            <ul className="proj-files">
              {data && Object.entries(data.files).map(([k, v]) => (
                <li key={k}><button className="linklike" onClick={() => saveOne(k)}>{k}</button><span className="muted small">{kb(v.length)}</span></li>
              ))}
            </ul>
            <p className="small muted" style={{ margin: 0 }}>A .tar opens with a double-click on Windows 11 and macOS.</p>
          </aside>
        </div>

        <h2 className="ds-h">What's wrong with the data (on purpose)</h2>
        <div className="mess">
          {PROJECT.mess.map(([a, b, c]) => (
            <div key={a} className="card mess-card">
              <b>{a}</b>
              <p>{b}</p>
              <p className="mess-do"><span>Your move</span>{c}</p>
            </div>
          ))}
        </div>

        <div className="spread proj-steps-head">
          <h2 className="ds-h" style={{ margin: 0 }}>The build, step by step</h2>
          <span className="small muted">{done} of {list.length} done</span>
        </div>
        <div className="progress" style={{ marginBottom: 18 }}><i style={{ width: (done / list.length) * 100 + '%' }} /></div>

        <ol className="proj-steps">
          {list.map((s, i) => (
            <li key={s.id} className={'card proj-step' + (p.checks[key(s.id)] ? ' done' : '')} id={s.id}>
              <div className="proj-step-top">
                <span className="how-n" aria-hidden="true">{i + 1}</span>
                <div><h3>{s.title}</h3><span className="small muted">About {s.time}</span></div>
              </div>
              <Markdown md={s.ask} className="prose no-try" />
              <details className="proj-hint"><summary>Hint</summary><p>{s.hint}</p></details>
              <details className="proj-sol"><summary>Show the solution</summary><Markdown md={s.solution} className="prose no-try" /></details>
              <div className="proj-check"><b>Checkpoint</b><Markdown md={s.check} className="prose no-try" /></div>
              <label className="row small proj-done"><input type="checkbox" checked={!!p.checks[key(s.id)]} onChange={() => toggleIn('checks', key(s.id))} /> I finished this step</label>
            </li>
          ))}
        </ol>

        <h2 className="ds-h">Ship it</h2>
        <div className="grid g2">
          <div className="card card-pad">
            <h3>README for your GitHub</h3>
            <p className="small muted">Copy it, put your own numbers in, and add a screenshot of the job graph.</p>
            <Markdown md={'```markdown\n' + README + '```'} className="prose no-try" />
          </div>
          <div className="stack" style={{ gap: 16 }}>
            <div className="card card-pad">
              <h3>Resume bullets</h3>
              <ul className="ticks">{RESUME.map((r) => <li key={r}>{r}</li>)}</ul>
            </div>
            <div className="card card-pad">
              <h3>Interview questions on this project</h3>
              <div className="faq">{TALKING.map(([q, a]) => <details key={q} className="faq-item"><summary>{q}</summary><p>{a}</p></details>)}</div>
            </div>
          </div>
        </div>

        <div className="card card-pad pro-end" style={{ marginTop: 32 }}>
          <div><h3>{PRO_PROJECT_COUNT - 1} more projects like this in Pro</h3><p className="muted">Streaming, CDC, data vault, Airflow, dbt, Docker and cloud builds on AWS, Azure and GCP, each with data, solutions and a README.</p></div>
          <Link className="btn btn-primary" to="/pro">Join the Pro waitlist</Link>
        </div>
      </div>
    </div>
  )
}
