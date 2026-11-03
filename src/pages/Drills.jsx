import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DRILLS } from '../data/drills.js'
import CodeEditor from '../components/CodeEditor.jsx'
import ResultTable from '../components/ResultTable.jsx'
import Markdown from '../components/Markdown.jsx'
import { EngineStatus } from './SqlLab.jsx'
import { runIsolated, compareResults } from '../lib/duck.js'
import { useProgress, setIn } from '../lib/progress.js'

export default function Drills() {
  const p = useProgress()
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div className="eyebrow">Incident drills</div>
          <h1>Fix the broken pipeline</h1>
          <p>It's 3 AM and the pager just went off. Each drill is a real failure pattern from production. Read the alert, look at the data, fix the SQL, and learn the prevention that stops it from happening again.</p>
        </div>
        <div className="grid g2">
          {DRILLS.map((d, i) => (
            <Link key={d.id} to={`/drills/${d.id}`} className="card card-pad card-link story">
              <div className="spread"><span className="chip">Drill {i + 1} · {d.level}</span>{p.drills[d.id] ? <span className="chip chip-ok">Resolved</span> : <span className="chip chip-danger">Open</span>}</div>
              <h2 style={{ margin: '12px 0 8px' }}>{d.title}</h2>
              <div className="pager">{d.pager}</div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Drill() {
  const { id } = useParams()
  return <DrillView key={id} id={id} />
}

function DrillView({ id }) {
  const d = DRILLS.find((x) => x.id === id)
  const p = useProgress()
  const [code, setCode] = useState(() => { try { return localStorage.getItem('z2h:code:drill:' + id) || d?.starter } catch (e) { return d?.starter } })
  const [res, setRes] = useState(null)
  const [verdict, setVerdict] = useState(null)
  const [busy, setBusy] = useState(false)
  const [engine, setEngine] = useState(null)
  const [peek, setPeek] = useState(null)
  const first = useRef(true)
  useEffect(() => { if (d) try { localStorage.setItem('z2h:code:drill:' + id, code) } catch (e) { /* ignore */ } }, [code, id])
  if (!d) return <div className="page container">Drill not found. <Link to="/drills">All drills</Link></div>
  const idx = DRILLS.indexOf(d)
  const next = DRILLS[idx + 1]
  const table = /CREATE TABLE (\w+)/.exec(d.setup)[1]

  async function go(fn) { setBusy(true); if (first.current) setEngine('loading'); try { return await fn() } finally { first.current = false; setEngine(null); setBusy(false) } }
  const run = () => go(async () => { setVerdict(null); setRes(await runIsolated({ setup: d.setup, sql: code })) })
  const check = () => go(async () => {
    const [r, w] = await Promise.all([runIsolated({ setup: d.setup, sql: code }), runIsolated({ setup: d.setup, sql: d.ref })])
    setRes(r)
    if (r.error) { setVerdict({ ok: false, why: 'Your SQL has an error.' }); return }
    const v = compareResults(r.result, w.result)
    setVerdict(v)
    if (v.ok) setIn('drills', d.id, Date.now())
  })
  const showData = () => go(async () => setPeek(await runIsolated({ setup: d.setup, sql: `SELECT * FROM ${table}` })))

  return (
    <div className="page">
      <div className="container narrow">
        <Link to="/drills" className="small">← All drills</Link>
        <div className="page-head" style={{ marginTop: 10 }}>
          <div className="eyebrow" style={{ color: 'var(--danger)' }}>Incident drill {idx + 1} · {d.level}</div>
          <h1>{d.title}</h1>
        </div>
        <div className="pager" style={{ marginBottom: 16 }}><b>🔔 PagerDuty</b> · {d.pager}</div>
        <Markdown md={d.story} />
        <div className="card card-pad" style={{ margin: '18px 0' }}>
          <b>Your task</b>
          <p style={{ margin: '6px 0 0' }}>{d.task}</p>
        </div>
        <div className="row" style={{ marginBottom: 12 }}>
          <button className="btn btn-ghost btn-sm" onClick={showData} disabled={busy}>Look at {table}</button>
          {p.drills[d.id] && <span className="chip chip-ok">Resolved</span>}
        </div>
        {peek && <div className="result" style={{ marginBottom: 12 }}><div className="result-head"><span>{table}</span><button className="btn btn-ghost btn-sm" onClick={() => setPeek(null)}>Hide</button></div>{peek.error ? <div className="err">{peek.error}</div> : <ResultTable result={peek.result} />}</div>}
        <CodeEditor value={code} onChange={setCode} onRun={run} minHeight={170} />
        <div className="toolbar">
          <button className="btn btn-ghost" onClick={run} disabled={busy}>▶ Run</button>
          <button className="btn btn-primary" onClick={check} disabled={busy}>Ship the fix</button>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setCode(d.starter); setRes(null); setVerdict(null) }}>Reset</button>
        </div>
        <EngineStatus state={engine} />
        {verdict && (
          <div className={'verdict ' + (verdict.ok ? 'ok' : 'bad')} style={{ margin: '10px 0' }}>
            <span>{verdict.ok ? '✅' : '❌'}</span>
            <div>{verdict.ok ? 'Incident resolved. The data is right again.' : 'Still broken.'}<small>{verdict.ok ? 'Now the important part: prevention, below.' : verdict.why}</small></div>
          </div>
        )}
        {res && <div className="result" style={{ marginTop: 8 }}><div className="result-head"><span>Result</span><span>{Math.round(res.ms)} ms</span></div>{res.error ? <div className="err">{res.error}</div> : <ResultTable result={res.result} />}</div>}
        <details className="reveal" style={{ marginTop: 16 }}><summary>Hint</summary><div className="inner"><Markdown md={d.hint} /></div></details>
        <details className="reveal" style={{ marginTop: 10 }} open={!!p.drills[d.id]}>
          <summary>Solution and prevention</summary>
          <div className="inner"><Markdown md={'```sql\n' + d.ref + '\n```'} /><div className="note"><b>Prevention: </b>{d.lesson}</div></div>
        </details>
        <div className="chapter-foot">
          <Link to="/drills"><small>←</small>All drills</Link>
          {next ? <Link className="next" to={`/drills/${next.id}`}><small>Next incident →</small>{next.title}</Link> : <Link className="next" to="/interview"><small>Next →</small>Interview prep</Link>}
        </div>
      </div>
    </div>
  )
}
