import { useEffect, useState } from 'react'

// A looping "live console" for the hero: types a real interview query, shows the result, checks it.
const SCRIPTS = [
  {
    file: 'top_earners.sql',
    sql: `SELECT dept, name, salary
FROM (
  SELECT *, DENSE_RANK() OVER (
    PARTITION BY dept ORDER BY salary DESC) AS rk
  FROM emp
) t
WHERE rk <= 2;`,
    cols: ['dept', 'name', 'salary'],
    rows: [['Data', 'Asha', '2,10,000'], ['Data', 'Ravi', '1,90,000'], ['Platform', 'Meera', '1,75,000'], ['Platform', 'Kabir', '1,60,000']],
    ms: 18,
  },
  {
    file: 'login_streaks.sql',
    sql: `SELECT user_id, MIN(d) AS start, COUNT(*) AS days
FROM (
  SELECT user_id, d,
    d - INTERVAL (ROW_NUMBER() OVER (
      PARTITION BY user_id ORDER BY d)) DAY AS grp
  FROM logins
) s
GROUP BY user_id, grp
HAVING COUNT(*) >= 3;`,
    cols: ['user_id', 'start', 'days'],
    rows: [['u_104', '2026-03-02', '5'], ['u_221', '2026-03-09', '3']],
    ms: 23,
  },
]

const KW = /\b(SELECT|FROM|WHERE|GROUP BY|ORDER BY|PARTITION BY|OVER|AS|HAVING|INTERVAL|DAY|MIN|COUNT|DENSE_RANK|ROW_NUMBER|DESC)\b/g

function paint(code) {
  const out = []
  let last = 0
  code.replace(KW, (m, _k, i) => { out.push(code.slice(last, i)); out.push(<b key={i}>{m}</b>); last = i + m.length; return m })
  out.push(code.slice(last))
  return out
}

export default function Console() {
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const [k, setK] = useState(0)
  const [n, setN] = useState(reduce ? Infinity : 0)
  const s = SCRIPTS[k % SCRIPTS.length]
  const typed = Math.min(n, s.sql.length)
  const done = typed >= s.sql.length
  const shownRows = done ? Math.max(0, Math.min(s.rows.length, Math.floor((n - s.sql.length) / 6))) : 0
  const verdict = done && n - s.sql.length > s.rows.length * 6 + 6

  useEffect(() => {
    if (reduce) return
    const t = setInterval(() => setN((x) => x + 1), 28)
    return () => clearInterval(t)
  }, [reduce])
  useEffect(() => {
    if (!reduce && n > s.sql.length + s.rows.length * 6 + 90) { setN(0); setK((x) => x + 1) }
  }, [n, s, reduce])

  return (
    <div className="console" aria-label="Example: a SQL query running in the browser lab">
      <div className="console-bar">
        <span className="dots"><i /><i /><i /></span>
        <span className="console-file">{s.file}</span>
        <span className="console-tag">DuckDB · in your browser</span>
      </div>
      <pre className="console-code">{paint(s.sql.slice(0, typed))}{!done && <span className="caret" />}</pre>
      <div className="console-out">
        <table>
          <thead><tr>{s.cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {s.rows.map((r, i) => <tr key={i} className={i < shownRows ? 'in' : ''}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
      <div className={'console-verdict' + (verdict ? ' in' : '')}>
        <span className="ok-dot" /> Matches the expected result <span className="muted">· {s.rows.length} rows · {s.ms} ms</span>
      </div>
    </div>
  )
}
