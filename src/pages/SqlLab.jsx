import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import data from '../content/sql-questions.json'
import CodeEditor from '../components/CodeEditor.jsx'
import ResultTable from '../components/ResultTable.jsx'
import Markdown from '../components/Markdown.jsx'
import Playground from './Playground.jsx'
import { runIsolated, compareResults } from '../lib/duck.js'
import { useProgress, setIn, getProgress } from '../lib/progress.js'

const QS = data.questions
const SECTIONS = [...new Set(QS.map((q) => q.section))]

function storeKey(n) { return `z2h:code:sql:${n}` }
function loadCode(q) {
  try { const v = localStorage.getItem(storeKey(q.n)); if (v) return v } catch (e) { /* ignore */ }
  if (q.starter) return q.starter
  return `-- ${q.title}\n-- Tables: ${q.tables.join(', ') || 'none'}\n\n`
}

const refCache = new Map()
async function expected(q) {
  if (!refCache.has(q.n)) {
    const p = runIsolated({ setup: q.setup, sql: q.ref, check: q.check })
    refCache.set(q.n, p)
    p.then((r) => { if (r.error) refCache.delete(q.n) })
  }
  return refCache.get(q.n)
}

export function EngineStatus({ state }) {
  if (state === 'loading') return <span className="loading"><span className="spinner" /> Starting the SQL engine. The first run downloads it once, then it's instant.</span>
  return null
}

export default function SqlLab() {
  const { n } = useParams()
  const navigate = useNavigate()
  const p = useProgress()
  if (n === 'scratch') return <Playground />
  const q = QS.find((x) => String(x.n) === String(n)) || QS[0]
  const solved = Object.values(p.sql).filter((v) => v === 'solved').length
  return (
    <div className="container">
      <div className="lab">
        <aside className="qlist card" style={{ padding: 8 }}>
          <div className="spread" style={{ padding: '6px 8px' }}><b>SQL lab</b><span className="chip chip-primary">{solved}/{QS.length}</span></div>
          <div style={{ padding: '0 8px 6px' }}><Link to="/playground" className="small">▶ SQL playground: run any query →</Link></div>
          {SECTIONS.map((s) => (
            <div key={s}>
              <div className="sec">{s}</div>
              {QS.filter((x) => x.section === s).map((x) => (
                <button key={x.n} className={x.n === q.n ? 'on' : ''} onClick={() => navigate(`/practice/sql/${x.n}`)}>
                  <span className="n">{x.n}</span><span>{x.title}</span>
                  <span className="st">{p.sql[x.n] === 'solved' ? '✅' : p.sql[x.n] === 'tried' ? '•' : ''}</span>
                </button>
              ))}
            </div>
          ))}
        </aside>
        <Question key={q.n} q={q} />
      </div>
    </div>
  )
}

function Question({ q }) {
  const navigate = useNavigate()
  const [code, setCode] = useState(() => loadCode(q))
  const [busy, setBusy] = useState(null)
  const [engine, setEngine] = useState(null)
  const [res, setRes] = useState(null)
  const [verdict, setVerdict] = useState(null)
  const [want, setWant] = useState(null)
  const [preview, setPreview] = useState(null)
  const p = useProgress()
  const idx = QS.findIndex((x) => x.n === q.n)
  const next = QS[idx + 1]
  const prev = QS[idx - 1]
  const firstRun = useRef(true)

  useEffect(() => { try { localStorage.setItem(storeKey(q.n), code) } catch (e) { /* ignore */ } }, [code, q.n])

  async function withEngine(fn) {
    if (firstRun.current) setEngine('loading')
    try { return await fn() } finally { firstRun.current = false; setEngine(null) }
  }

  async function run() {
    setBusy('run'); setVerdict(null); setWant(null)
    const r = await withEngine(() => runIsolated({ setup: q.setup, sql: code, check: q.check }))
    setRes(r); setBusy(null)
    if (!getProgress().sql[q.n]) setIn('sql', q.n, 'tried')
  }

  async function check() {
    setBusy('check'); setWant(null)
    const [r, w] = await withEngine(() => Promise.all([runIsolated({ setup: q.setup, sql: code, check: q.check }), expected(q)]))
    setRes(r); setBusy(null)
    if (r.error) { setVerdict({ ok: false, why: 'Your SQL has an error. Fix it and check again.' }); return }
    if (w.error) { setVerdict({ ok: false, why: 'Could not compute the expected answer: ' + w.error }); return }
    const v = compareResults(r.result, w.result)
    setVerdict(v)
    if (v.ok) setIn('sql', q.n, 'solved')
    else { setWant(w.result); if (getProgress().sql[q.n] !== 'solved') setIn('sql', q.n, 'tried') }
  }

  async function showTable(t) {
    setBusy('table')
    const r = await withEngine(() => runIsolated({ setup: q.setup, sql: `SELECT * FROM ${t} LIMIT 50` }))
    setPreview({ t, r }); setBusy(null)
  }

  const isConcept = q.mode === 'concept'
  return (
    <section>
      <div className="qhead">
        <div className="row small muted"><span>{q.section}</span><span>·</span><span>Question {q.n} of {QS.length}</span>{p.sql[q.n] === 'solved' && <span className="chip chip-ok">Solved</span>}</div>
        <h2>{q.title}</h2>
      </div>
      {q.given && q.given !== '—' && <div className="given">{q.given}</div>}
      {q.hint && <p className="small" style={{ marginTop: 8 }}><b>Note:</b> {q.hint}</p>}
      {q.tables.length > 0 && (
        <div className="schema" style={{ margin: '12px 0' }}>
          <span className="small muted" style={{ alignSelf: 'center' }}>Peek at the data:</span>
          {q.tables.map((t) => <button key={t} className="btn btn-ghost btn-sm" onClick={() => showTable(t)} disabled={!!busy}>{t}</button>)}
        </div>
      )}
      {preview && (
        <div className="result" style={{ marginBottom: 12 }}>
          <div className="result-head"><span>{preview.t}</span><button className="btn btn-ghost btn-sm" onClick={() => setPreview(null)}>Hide</button></div>
          {preview.r.error ? <div className="err">{preview.r.error}</div> : <ResultTable result={preview.r.result} />}
        </div>
      )}
      {isConcept && <div className="note" style={{ margin: '12px 0' }}><b>Concept question.</b> Say your answer out loud first, then reveal it. {q.tables.length ? 'You can experiment with the tables below.' : ''}</div>}
      {(!isConcept || q.tables.length > 0) && (
        <>
          <CodeEditor value={code} onChange={setCode} onRun={run} />
          <div className="toolbar">
            <button className="btn btn-ghost" onClick={run} disabled={!!busy}>{busy === 'run' ? 'Running…' : '▶ Run'}</button>
            {!isConcept && <button className="btn btn-primary" onClick={check} disabled={!!busy}>{busy === 'check' ? 'Checking…' : 'Check answer'}</button>}
            <span className="small muted hide-sm">Ctrl/Cmd + Enter to run</span>
            <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setCode(q.starter || `-- ${q.title}\n\n`); setRes(null); setVerdict(null) }}>Reset</button>
          </div>
          <EngineStatus state={engine} />
        </>
      )}
      {verdict && (
        <div className={'verdict ' + (verdict.ok ? 'ok' : 'bad')} style={{ margin: '10px 0' }}>
          <span>{verdict.ok ? '✅' : '❌'}</span>
          <div>{verdict.ok ? 'Correct! Your result matches.' : 'Not yet.'}<small>{verdict.ok ? (verdict.note || 'Read the explanation below to see what interviewers listen for.') : verdict.why}</small></div>
        </div>
      )}
      {res && (
        <div className="result" style={{ marginTop: 8 }}>
          <div className="result-head"><span>Your result {res.result ? `· ${res.result.rows.length} row${res.result.rows.length === 1 ? '' : 's'}` : ''}</span><span>{Math.round(res.ms)} ms</span></div>
          {res.error ? <div className="err">{res.stage === 'check' ? 'After your statement, the check query failed: ' : ''}{res.error}</div> : <ResultTable result={res.result} />}
        </div>
      )}
      {want && (
        <details className="reveal" style={{ marginTop: 12 }}>
          <summary>Show the expected result</summary>
          <div className="inner"><div className="result"><ResultTable result={want} /></div></div>
        </details>
      )}
      <details className="reveal" style={{ marginTop: 16 }} open={isConcept && p.sql[q.n] === 'solved'}>
        <summary>Reveal the answer and explanation</summary>
        <div className="inner">
          <Markdown md={'```sql\n' + q.answer + '\n```'} />
          {q.note && <div className="note"><b>Why: </b>{q.note}</div>}
          {isConcept && p.sql[q.n] !== 'solved' && <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setIn('sql', q.n, 'solved')}>I knew this</button>}
        </div>
      </details>
      <div className="chapter-foot">
        {prev ? <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/practice/sql/${prev.n}`) }}><small>← {prev.n}</small>{prev.title}</a> : <span />}
        {next ? <a href="#" className="next" onClick={(e) => { e.preventDefault(); navigate(`/practice/sql/${next.n}`) }}><small>{next.n} →</small>{next.title}</a> : <Link className="next" to="/drills"><small>Next →</small>Incident drills</Link>}
      </div>
    </section>
  )
}
