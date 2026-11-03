import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import CodeEditor from '../components/CodeEditor.jsx'
import ResultTable from '../components/ResultTable.jsx'
import { runIsolated, ensureBig, forgetBig } from '../lib/duck.js'
import { BIG, BIG_TOTAL, BIG_EXAMPLES, bigSetupSql } from '../data/bigdata.js'
import data from '../content/sql-questions.json'

const SAMPLE_SETUP = [1, 8, 25].map((n) => data.questions.find((q) => q.n === n).setup).join('\n')

const MAX_ROWS = 1000
const SMALL = [
  ['emp', 'id, name, dept_id, salary, manager_id, hire_date'],
  ['dept', 'id, name'],
  ['customers', 'customer_id, name'],
  ['orders', 'order_id, customer_id, order_date, amount, status'],
  ['daily_sales', 'sale_date, amount'],
]
const SMALL_EXAMPLES = [
  ['Top earners', 'SELECT name, salary\nFROM emp\nORDER BY salary DESC\nLIMIT 5;'],
  ['Join + group', 'SELECT d.name AS dept, COUNT(*) AS people, ROUND(AVG(e.salary)) AS avg_salary\nFROM emp e\nJOIN dept d ON d.id = e.dept_id\nGROUP BY d.name\nORDER BY avg_salary DESC;'],
  ['Rank in dept', 'SELECT name, dept_id, salary,\n       DENSE_RANK() OVER (PARTITION BY dept_id ORDER BY salary DESC) AS rnk\nFROM emp\nORDER BY dept_id, rnk;'],
  ['Who manages whom', 'SELECT e.name AS employee, m.name AS manager\nFROM emp e\nLEFT JOIN emp m ON m.id = e.manager_id;'],
  ['Never ordered', 'SELECT c.name\nFROM customers c\nWHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);'],
  ['Running total', 'SELECT sale_date, amount,\n       SUM(amount) OVER (ORDER BY sale_date) AS running_total\nFROM daily_sales\nORDER BY sale_date;'],
  ['Your own table', "CREATE TABLE skills(name VARCHAR, level INT);\nINSERT INTO skills VALUES ('SQL', 9), ('Spark', 7), ('Airflow', 6);\nSELECT * FROM skills ORDER BY level DESC;"],
]
const DEFAULT_SQL = BIG_EXAMPLES[0][1]
const fmtN = (n) => n.toLocaleString('en-IN')

function initialCode() {
  try { return sessionStorage.getItem('z2h:scratch') || localStorage.getItem('z2h:code:sql:scratch') || DEFAULT_SQL } catch (e) { return DEFAULT_SQL }
}

export default function Playground() {
  const [code, setCode] = useState(initialCode)
  const [big, setBig] = useState(() => typeof window === 'undefined' || window.innerWidth >= 700)
  const [tab, setTab] = useState('big')
  const [res, setRes] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const [open, setOpen] = useState(null)
  const bigReady = useRef(false)
  useEffect(() => { try { sessionStorage.removeItem('z2h:scratch') } catch (e) { /* ignore */ } }, [])
  useEffect(() => { try { localStorage.setItem('z2h:code:sql:scratch', code) } catch (e) { /* ignore */ } }, [code])

  async function runWith(sql, useBig = big, reset = false) {
    setBusy(true)
    const t0 = performance.now()
    try {
      if (useBig) {
        if (!bigReady.current || reset) setStatus(`Building ${(BIG_TOTAL / 1e6).toFixed(1)} million rows of practice data in your browser. This happens once per visit and takes a few seconds.`)
        else setStatus(null)
        await ensureBig(bigSetupSql(), { reset, names: BIG.map((b) => b.name) })
        bigReady.current = true
      } else setStatus('Starting the SQL engine. The first run downloads it once, then it is instant.')
      const r = await runIsolated({ setup: SAMPLE_SETUP, sql, maxRows: MAX_ROWS })
      if (r.error && /shop_|web_events|taxi_trips/.test(r.error) && /does not exist/.test(r.error)) forgetBig()
      setRes({ ...r, total: performance.now() - t0 })
    } catch (e) {
      setRes({ error: String(e?.message || e), ms: 0 })
    }
    setStatus(null); setBusy(false)
  }
  const run = () => runWith(code)
  const load = (sql, useBig) => { setCode(sql); if (useBig && !big) setBig(true); runWith(sql, useBig || big) }
  const peek = (t, useBig) => load(`SELECT *\nFROM ${t}\nLIMIT 100;`, useBig)

  const examples = tab === 'big' ? BIG_EXAMPLES : SMALL_EXAMPLES
  return (
    <div className="page play">
      <div className="container wide">
        <div className="play-head">
          <div>
            <div className="eyebrow">SQL playground</div>
            <h1>Run <em>any</em> query.</h1>
            <p className="muted">A real DuckDB engine inside your browser, with {(BIG_TOTAL / 1e6).toFixed(1)} million rows of practice data. Nothing to install, nothing to sign up for. Press <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to run.</p>
          </div>
          <Link to="/practice/sql" className="btn btn-ghost btn-sm">Guided SQL questions →</Link>
        </div>

        <div className="play-grid">
          <aside className="play-side card">
            <div className="spread"><b>Datasets</b>
              <label className="row small" title="Large tables are generated in your browser on first use"><input type="checkbox" checked={big} onChange={(e) => setBig(e.target.checked)} /> Big data</label>
            </div>
            <div className="ds-sec">Big · generated in your browser</div>
            {BIG.map((b) => (
              <div key={b.name} className={'ds' + (open === b.name ? ' on' : '') + (big ? '' : ' off')}>
                <button className="ds-top" onClick={() => setOpen(open === b.name ? null : b.name)}>
                  <code>{b.name}</code><span className="ds-n">{b.rows >= 1e6 ? b.rows / 1e6 + 'M' : b.rows / 1e3 + 'K'}</span>
                </button>
                {open === b.name && (
                  <div className="ds-body">
                    <p>{b.about}</p>
                    <div className="ds-cols">{b.cols}</div>
                    <button className="btn btn-ghost btn-sm" onClick={() => peek(b.name, true)}>Preview 100 rows</button>
                  </div>
                )}
              </div>
            ))}
            <div className="ds-sec">Small · reloaded every run</div>
            {SMALL.map(([t, c]) => (
              <div key={t} className={'ds' + (open === t ? ' on' : '')}>
                <button className="ds-top" onClick={() => setOpen(open === t ? null : t)}><code>{t}</code><span className="ds-n">tiny</span></button>
                {open === t && <div className="ds-body"><div className="ds-cols">{c}</div><button className="btn btn-ghost btn-sm" onClick={() => peek(t, false)}>Preview rows</button></div>}
              </div>
            ))}
            <p className="small muted" style={{ margin: '14px 2px 0' }}>Tables you CREATE are cleared after each run. Changes to big tables last until you reload or reset.</p>
            {big && <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} disabled={busy} onClick={() => runWith(code, true, true)}>Reset big datasets</button>}
          </aside>

          <div className="play-main">
            <div className="play-examples">
              <div className="tabs"><button className={tab === 'big' ? 'on' : ''} onClick={() => setTab('big')}>Big data examples</button><button className={tab === 'small' ? 'on' : ''} onClick={() => setTab('small')}>Basics</button></div>
              <div className="chips">
                {examples.map(([label, sql]) => <button key={label} className="chip-btn" disabled={busy} onClick={() => load(sql, tab === 'big')}>{label}</button>)}
              </div>
            </div>
            <div className="play-editor card">
              <CodeEditor value={code} onChange={setCode} onRun={run} minHeight={300} />
              <div className="play-bar">
                <button className="btn btn-primary" onClick={run} disabled={busy}>{busy ? 'Running…' : '▶ Run'}</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setCode('')} disabled={busy}>Clear</button>
                <span className="small muted">DuckDB SQL: <code>LIMIT</code> not <code>TOP</code>, plus extras like <code>QUALIFY</code> and <code>GROUP BY ALL</code>.</span>
              </div>
            </div>
            {status && <div className="loading" style={{ marginTop: 12 }}><span className="spinner" /> {status}</div>}
            {res && (
              <div className="result play-result">
                <div className="result-head">
                  <span>{res.error ? 'Error' : res.result ? (res.more ? `First ${fmtN(MAX_ROWS)} rows (there are more)` : `${fmtN(res.result.rows.length)} rows`) : 'Done'}</span>
                  <span>{Math.round(res.ms)} ms</span>
                </div>
                {res.error ? <div className="err">{res.error}</div> : <ResultTable result={res.result} max={MAX_ROWS} />}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
