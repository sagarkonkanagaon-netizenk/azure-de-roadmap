import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

/* ───────────── Join visualiser ───────────── */
const CUST = [{ id: 1, name: 'Asha' }, { id: 2, name: 'Ravi' }, { id: 3, name: 'Meera' }, { id: 4, name: 'Kabir' }]
const ORD = [{ oid: 101, cid: 1, amt: 450 }, { oid: 102, cid: 1, amt: 120 }, { oid: 103, cid: 3, amt: 980 }, { oid: 104, cid: 5, amt: 60 }]
const JOINS = {
  inner: { label: 'INNER', sql: 'SELECT c.name, o.oid, o.amt\nFROM customers c\nJOIN orders o ON o.cid = c.id;', note: 'Only rows that match on both sides. Kabir (no orders) and order 104 (unknown customer) disappear.' },
  left: { label: 'LEFT', sql: 'SELECT c.name, o.oid, o.amt\nFROM customers c\nLEFT JOIN orders o ON o.cid = c.id;', note: 'Every customer stays. Customers with no orders get NULLs. Asha appears twice because she has two orders: joins multiply rows.' },
  right: { label: 'RIGHT', sql: 'SELECT c.name, o.oid, o.amt\nFROM customers c\nRIGHT JOIN orders o ON o.cid = c.id;', note: 'Every order stays. Order 104 points at customer 5, who does not exist, so the customer side is NULL: an orphan row.' },
  full: { label: 'FULL', sql: 'SELECT c.name, o.oid, o.amt\nFROM customers c\nFULL JOIN orders o ON o.cid = c.id;', note: 'Everything from both sides. Useful for reconciliation: NULLs on either side show what is missing where.' },
  anti: { label: 'ANTI', sql: 'SELECT c.name\nFROM customers c\nLEFT JOIN orders o ON o.cid = c.id\nWHERE o.oid IS NULL;', note: 'Customers who never ordered. The classic "find what is missing" pattern; NOT EXISTS does the same and is safe with NULLs.' },
}

function joinRows(kind) {
  const out = []
  if (kind === 'anti') { for (const c of CUST) if (!ORD.some((o) => o.cid === c.id)) out.push({ c, o: null }); return out }
  for (const c of CUST) {
    const m = ORD.filter((o) => o.cid === c.id)
    if (m.length) m.forEach((o) => out.push({ c, o }))
    else if (kind === 'left' || kind === 'full') out.push({ c, o: null })
  }
  if (kind === 'right' || kind === 'full') for (const o of ORD) if (!CUST.some((c) => c.id === o.cid)) out.push({ c: null, o })
  if (kind === 'right') return out.filter((r) => r.o)
  return out
}

function JoinViz() {
  const [kind, setKind] = useState('left')
  const rows = useMemo(() => joinRows(kind), [kind])
  const [shown, setShown] = useState(0)
  const [hover, setHover] = useState(null)
  useEffect(() => {
    setShown(0)
    const t = setInterval(() => setShown((n) => { if (n >= rows.length) { clearInterval(t); return n } return n + 1 }), 420)
    return () => clearInterval(t)
  }, [rows])
  const cur = rows[shown - 1]
  const litC = (c) => (hover ? hover.c?.id === c.id : cur?.c?.id === c.id)
  const litO = (o) => (hover ? hover.o?.oid === o.oid : cur?.o?.oid === o.oid)
  const cols = kind === 'anti' ? ['name'] : ['name', 'oid', 'amt']
  return (
    <div className="viz card">
      <div className="viz-head">
        <div><div className="tile-k">Joins, row by row</div><h3 style={{ margin: '4px 0 0' }}>Which rows survive?</h3></div>
        <div className="tabs">{Object.entries(JOINS).map(([k, j]) => <button key={k} className={k === kind ? 'on' : ''} onClick={() => setKind(k)}>{j.label}</button>)}</div>
      </div>
      <div className="viz-body">
        <div className="viz-tables">
          <table className="vt"><caption>customers</caption><thead><tr><th>id</th><th>name</th></tr></thead>
            <tbody>{CUST.map((c) => <tr key={c.id} className={litC(c) ? 'lit' : ''}><td>{c.id}</td><td>{c.name}</td></tr>)}</tbody></table>
          <div className="viz-on">ON o.cid = c.id</div>
          <table className="vt"><caption>orders</caption><thead><tr><th>oid</th><th>cid</th><th>amt</th></tr></thead>
            <tbody>{ORD.map((o) => <tr key={o.oid} className={litO(o) ? 'lit' : ''}><td>{o.oid}</td><td>{o.cid}</td><td>{o.amt}</td></tr>)}</tbody></table>
        </div>
        <div>
          <pre className="mini-code" style={{ marginTop: 0 }}>{JOINS[kind].sql}</pre>
          <table className="vt result"><caption>result · {rows.length} rows</caption>
            <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={kind + i} className={i < shown ? 'in' : ''} onMouseEnter={() => setHover(r)} onMouseLeave={() => setHover(null)}>
                  <td className={r.c ? '' : 'null'}>{r.c ? r.c.name : 'NULL'}</td>
                  {kind !== 'anti' && <td className={r.o ? '' : 'null'}>{r.o ? r.o.oid : 'NULL'}</td>}
                  {kind !== 'anti' && <td className={r.o ? '' : 'null'}>{r.o ? r.o.amt : 'NULL'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="viz-note">{JOINS[kind].note}</p>
    </div>
  )
}

/* ───────────── Window function visualiser ───────────── */
const SALES = [
  { dept: 'Data', name: 'Asha', amt: 900 }, { dept: 'Data', name: 'Ravi', amt: 700 }, { dept: 'Data', name: 'Isha', amt: 700 }, { dept: 'Data', name: 'Dev', amt: 400 },
  { dept: 'Platform', name: 'Meera', amt: 800 }, { dept: 'Platform', name: 'Kabir', amt: 500 }, { dept: 'Platform', name: 'Zoya', amt: 300 },
]
const FNS = {
  row_number: { label: 'ROW_NUMBER', expr: 'ROW_NUMBER() OVER (PARTITION BY dept ORDER BY amt DESC)', note: 'Always 1, 2, 3, 4. Ties (Ravi and Isha) get different numbers, in no guaranteed order. Use it to pick exactly one row per group.' },
  rank: { label: 'RANK', expr: 'RANK() OVER (PARTITION BY dept ORDER BY amt DESC)', note: 'Ties share a rank, then it skips: 1, 2, 2, 4. "Top 2" with RANK can return three rows.' },
  dense_rank: { label: 'DENSE_RANK', expr: 'DENSE_RANK() OVER (PARTITION BY dept ORDER BY amt DESC)', note: 'Ties share a rank with no gaps: 1, 2, 2, 3. The usual answer for "Nth highest salary".' },
  running: { label: 'Running SUM', expr: 'SUM(amt) OVER (PARTITION BY dept ORDER BY amt DESC\n  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW)', note: 'The frame grows one row at a time and restarts in each partition. Without ROWS, the default RANGE frame would add tied rows together.' },
  lag: { label: 'LAG', expr: 'LAG(amt) OVER (PARTITION BY dept ORDER BY amt DESC)', note: 'Looks one row back inside the partition. The first row of each partition has nothing behind it, so it gets NULL.' },
}

function computeWin(fn) {
  const rows = [...SALES].sort((a, b) => a.dept.localeCompare(b.dept) || b.amt - a.amt)
  let prevDept = null, rn = 0, rk = 0, drk = 0, prevAmt = null, sum = 0
  return rows.map((r, i) => {
    if (r.dept !== prevDept) { rn = 0; rk = 0; drk = 0; prevAmt = null; sum = 0; prevDept = r.dept }
    rn++
    if (r.amt !== prevAmt) { rk = rn; drk++ }
    sum += r.amt
    const lag = rn === 1 ? null : rows[i - 1].amt
    const start = i - rn + 1
    const v = { row_number: rn, rank: rk, dense_rank: drk, running: sum, lag }[fn]
    const frame = fn === 'running' ? [start, i] : fn === 'lag' ? (rn === 1 ? [] : [i - 1, i - 1]) : [start, start + SALES.filter((x) => x.dept === r.dept).length - 1]
    prevAmt = r.amt
    return { ...r, v, frame }
  })
}

function WindowViz() {
  const [fn, setFn] = useState('rank')
  const rows = useMemo(() => computeWin(fn), [fn])
  const [cur, setCur] = useState(0)
  const [play, setPlay] = useState(true)
  useEffect(() => { setCur(0) }, [fn])
  useEffect(() => {
    if (!play) return
    const t = setInterval(() => setCur((c) => (c + 1) % (rows.length + 2)), 900)
    return () => clearInterval(t)
  }, [play, rows.length])
  const at = Math.min(cur, rows.length - 1)
  const r = rows[at]
  const inFrame = (i) => r.frame.length && i >= r.frame[0] && i <= r.frame[1]
  return (
    <div className="viz card">
      <div className="viz-head">
        <div><div className="tile-k">Window functions, frame by frame</div><h3 style={{ margin: '4px 0 0' }}>What does the engine see for each row?</h3></div>
        <div className="tabs">{Object.entries(FNS).map(([k, f]) => <button key={k} className={k === fn ? 'on' : ''} onClick={() => setFn(k)}>{f.label}</button>)}</div>
      </div>
      <pre className="mini-code">SELECT dept, name, amt,<br />  {FNS[fn].expr} AS result<br />FROM sales;</pre>
      <table className="vt wide" style={{ marginTop: 14 }}>
        <thead><tr><th>dept</th><th>name</th><th>amt</th><th>result</th></tr></thead>
        <tbody>
          {rows.map((x, i) => (
            <tr key={i} className={(x.dept === 'Data' ? 'p1' : 'p2') + (i === at ? ' cur' : '') + (inFrame(i) ? ' frame' : '')} onClick={() => { setPlay(false); setCur(i) }}>
              <td>{x.dept}</td><td>{x.name}</td><td>{x.amt}</td>
              <td className={'res' + (x.v === null ? ' null' : '')}>{i <= at ? (x.v === null ? 'NULL' : x.v) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setPlay((v) => !v)}>{play ? '❚❚ Pause' : '▶ Play'}</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { setPlay(false); setCur((c) => Math.min(rows.length - 1, c + 1)) }}>Step →</button>
        <span className="small muted">Click any row. Shaded rows are the window the engine uses for the current row.</span>
      </div>
      <p className="viz-note">{FNS[fn].note}</p>
    </div>
  )
}

export default function Visual() {
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div className="eyebrow">Visual SQL</div>
          <h1>See it <em>click.</em></h1>
          <p>The two ideas that trip people up most in SQL interviews, animated row by row. Change the join or the function and watch what the engine does.</p>
        </div>
        <div className="stack" style={{ gap: 22 }}>
          <JoinViz />
          <WindowViz />
        </div>
        <div className="row" style={{ marginTop: 26 }}>
          <Link className="btn btn-primary" to="/practice/sql/7">Try the join trap question</Link>
          <Link className="btn btn-ghost" to="/learn/sql">Read the SQL handbook</Link>
        </div>
      </div>
    </div>
  )
}
