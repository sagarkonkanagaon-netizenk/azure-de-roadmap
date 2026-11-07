import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import data from '../content/py-questions.json'
import CodeEditor from '../components/CodeEditor.jsx'
import Markdown from '../components/Markdown.jsx'
import { runPython, stopPython, isPyReady } from '../lib/py.js'
import { useProgress, setIn, getProgress } from '../lib/progress.js'

const QS = data.questions.filter((q) => q.section === 'Python')

function starter(q) {
  const m = /^def (\w+)\(([^)]*)\)/m.exec(q.answer)
  if (q.check && m) {
    return `def ${m[1]}(${m[2]}):\n    # your code here\n    pass\n\n\nprint(${m[1]}(${q.check.args}))  # expected: ${q.given.split('→')[1]?.split(',')[0]?.trim() || '?'}\n`
  }
  if (m) return `def ${m[1]}(${m[2]}):\n    # your code here\n    pass\n`
  return `# ${q.title}\n# ${q.given}\n\n`
}

function key(n) { return `z2h:code:py:${n}` }

export default function PyLab() {
  const { n } = useParams()
  const navigate = useNavigate()
  const p = useProgress()
  const q = QS.find((x) => String(x.n) === String(n)) || QS[0]
  const solved = QS.filter((x) => p.py[x.n] === 'solved').length
  const [listOpen, setListOpen] = useState(false)
  return (
    <div className="container">
      <div className="lab">
        <aside className={'qlist card' + (listOpen ? ' open' : '')} style={{ padding: 8 }}>
          <div className="spread" style={{ padding: '6px 8px' }}><b>Python lab</b><span className="chip chip-primary">{solved}/{QS.length}</span></div>
          <div className="small muted" style={{ padding: '0 8px 6px' }}>PySpark questions are in <Link to="/interview/pyspark">Interview → PySpark</Link>.</div>
          <button className="qlist-toggle" aria-expanded={listOpen} onClick={() => setListOpen(!listOpen)}>
            <span>Problem {q.n} of {QS.length}</span><b>{listOpen ? 'Hide list ▴' : 'All problems ▾'}</b>
          </button>
          <div className="qlist-body" onClick={() => setListOpen(false)}>
          {QS.map((x) => (
            <button key={x.n} className={x.n === q.n ? 'on' : ''} onClick={() => navigate(`/practice/python/${x.n}`)}>
              <span className="n">{x.n}</span><span>{x.title}</span><span className="st">{p.py[x.n] === 'solved' ? '✅' : p.py[x.n] === 'tried' ? '•' : ''}</span>
            </button>
          ))}
          </div>
        </aside>
        <PyQuestion key={q.n} q={q} />
      </div>
    </div>
  )
}

function PyQuestion({ q }) {
  const navigate = useNavigate()
  const p = useProgress()
  const [code, setCode] = useState(() => { try { return localStorage.getItem(key(q.n)) || starter(q) } catch (e) { return starter(q) } })
  const [busy, setBusy] = useState(null)
  const [out, setOut] = useState(null)
  const [verdict, setVerdict] = useState(null)
  useEffect(() => { try { localStorage.setItem(key(q.n), code) } catch (e) { /* ignore */ } }, [code, q.n])
  const idx = QS.findIndex((x) => x.n === q.n)
  const prev = QS[idx - 1]
  const next = QS[idx + 1]

  async function run() {
    setBusy('run'); setVerdict(null)
    const r = await runPython(code)
    setOut(r); setBusy(null)
    if (!getProgress().py[q.n]) setIn('py', q.n, 'tried')
  }
  async function check() {
    setBusy('check')
    const r = await runPython(code, { ref: q.answer, ...q.check })
    setBusy(null); setOut(r)
    if (r.error) { setVerdict({ ok: false, why: r.error.split('\n').slice(-1)[0] }); return }
    setVerdict(r.verdict)
    if (r.verdict.ok) setIn('py', q.n, 'solved')
  }
  return (
    <section>
      <div className="qhead">
        <div className="row small muted"><span>Python</span><span>·</span><span>Question {q.n}</span>{p.py[q.n] === 'solved' && <span className="chip chip-ok">Solved</span>}</div>
        <h1 className="q-title">{q.title}</h1>
      </div>
      {q.given && <div className="given">{q.given}</div>}
      <div style={{ marginTop: 12 }}><CodeEditor value={code} onChange={setCode} onRun={run} lang="python" minHeight={200} /></div>
      <div className="toolbar">
        <button className="btn btn-ghost" onClick={run} disabled={!!busy}>{busy === 'run' ? 'Running…' : '▶ Run'}</button>
        {q.check && <button className="btn btn-primary" onClick={check} disabled={!!busy}>{busy === 'check' ? 'Checking…' : 'Check answer'}</button>}
        {busy && <button className="btn btn-ghost btn-sm" onClick={() => { stopPython(); setBusy(null) }}>Stop</button>}
        <button className="btn btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => { setCode(starter(q)); setOut(null); setVerdict(null) }}>Reset</button>
      </div>
      {busy && !isPyReady() && <span className="loading"><span className="spinner" /> Starting Python in your browser. The first run downloads it once.</span>}
      {!q.check && <p className="small muted">No auto-check for this one: run your code, then compare with the answer.</p>}
      {verdict && (
        <div className={'verdict ' + (verdict.ok ? 'ok' : 'bad')} style={{ margin: '10px 0' }}>
          <span>{verdict.ok ? '✅' : '❌'}</span>
          <div>{verdict.ok ? 'Correct on the example.' : 'Not yet.'}
            <small>{verdict.ok ? 'Now think about edge cases: empty input, duplicates, very large input.' : verdict.why || `Got ${verdict.got}, expected ${verdict.want}.`}</small>
          </div>
        </div>
      )}
      {out && (out.out || out.error) && (
        <div className="result" style={{ marginTop: 8 }}>
          <div className="result-head"><span>Output</span></div>
          {out.out && <pre className="out">{out.out}</pre>}
          {out.error && <div className="err">{out.error}</div>}
        </div>
      )}
      <details className="reveal" style={{ marginTop: 16 }}>
        <summary>Reveal the answer and explanation</summary>
        <div className="inner">
          <Markdown md={'```python\n' + q.answer + '\n```'} />
          {q.note && <div className="note"><b>Why: </b>{q.note}</div>}
          {!q.check && p.py[q.n] !== 'solved' && <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setIn('py', q.n, 'solved')}>Mark as solved</button>}
        </div>
      </details>
      <div className="chapter-foot">
        {prev ? <a href="#" onClick={(e) => { e.preventDefault(); navigate(`/practice/python/${prev.n}`) }}><small>← {prev.n}</small>{prev.title}</a> : <span />}
        {next ? <a href="#" className="next" onClick={(e) => { e.preventDefault(); navigate(`/practice/python/${next.n}`) }}><small>{next.n} →</small>{next.title}</a> : <Link className="next" to="/interview/pyspark"><small>Next →</small>PySpark questions</Link>}
      </div>
    </section>
  )
}
