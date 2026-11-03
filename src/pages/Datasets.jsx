import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import sqlQ from '../content/sql-questions.json'
import { BIG } from '../data/bigdata.js'
import { parseSchema, ABOUT, typeLabel } from '../lib/schema.js'

const fmt = (n) => (n >= 1e6 ? n / 1e6 + 'M' : n >= 1e3 ? n / 1e3 + 'K' : String(n))

const LINKS = [
  ['emp.dept_id', 'dept.id', 'Which department each employee is in'],
  ['emp.manager_id', 'emp.id', 'Each employee’s manager (a self join)'],
  ['orders.customer_id', 'customers.customer_id', 'Who placed each order'],
  ['shop_orders.customer_id', 'shop_customers.customer_id', 'Who bought it'],
  ['shop_orders.product_id', 'shop_products.product_id', 'What was bought'],
]

// Every practice table in one place: what it holds, its columns, and where it is used.
export default function Datasets() {
  const [q, setQ] = useState('')
  const small = useMemo(() => {
    const map = new Map()
    for (const x of sqlQ.questions) {
      if (!x.tables.length) continue
      for (const t of parseSchema(x.setup, x.tables)) {
        const cur = map.get(t.name) || { ...t, used: [] }
        if (t.cols.length > cur.cols.length) cur.cols = t.cols
        cur.rows = Math.max(cur.rows, t.rows)
        cur.used.push(x.n)
        map.set(t.name, cur)
      }
    }
    return [...map.values()].sort((a, b) => b.used.length - a.used.length || a.name.localeCompare(b.name))
  }, [])
  const f = q.trim().toLowerCase()
  const match = (name, cols) => !f || name.toLowerCase().includes(f) || cols.some((c) => c.toLowerCase().includes(f))
  const big = BIG.filter((b) => match(b.name, b.cols.split(', ')))
  const shown = small.filter((t) => match(t.name, t.cols.map((c) => c.name)))
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div className="eyebrow">Practice</div>
          <h1>Practice tables</h1>
          <p>Every table you can query on this site, with its columns in plain words. You never need to create these yourself: they are ready the moment you press Run.</p>
        </div>

        <input className="input ds-search" placeholder="Find a table or column, for example salary" value={q} onChange={(e) => setQ(e.target.value)} />

        <h2 className="ds-h">How the main tables connect</h2>
        <div className="ds-links">
          {LINKS.map(([a, b, why]) => (
            <div key={a} className="ds-link"><code>{a}</code><span className="ds-arrow">→</span><code>{b}</code><span className="small muted">{why}</span></div>
          ))}
        </div>

        {big.length > 0 && <>
          <h2 className="ds-h">Big tables <span className="small muted">in the <Link to="/playground">SQL Playground</Link></span></h2>
          <div className="tables-grid">
            {big.map((b) => (
              <div key={b.name} className="tcard">
                <div className="tcard-top static"><code>{b.name}</code><span className="tcard-n">{fmt(b.rows)} rows</span></div>
                <p className="tcard-about">{b.about}</p>
                <ul className="tcols">{b.cols.split(', ').map((c) => <li key={c}><code>{c}</code></li>)}</ul>
              </div>
            ))}
          </div>
        </>}

        <h2 className="ds-h">SQL Lab tables <span className="small muted">small, so you can check answers by eye</span></h2>
        <div className="tables-grid">
          {shown.map((t) => (
            <div key={t.name} className="tcard">
              <div className="tcard-top static"><code>{t.name}</code><span className="tcard-n">{t.rows ? t.rows + ' rows' : ''}</span></div>
              {ABOUT[t.name] && <p className="tcard-about">{ABOUT[t.name]}</p>}
              <ul className="tcols">{t.cols.map((c) => <li key={c.name}><code>{c.name}</code><span>{typeLabel(c.type)}</span></li>)}</ul>
              <div className="tcard-used small muted">Used in {t.used.slice(0, 6).map((n, i) => <span key={n}>{i ? ', ' : ''}<Link to={`/practice/sql/${n}`}>Q{n}</Link></span>)}{t.used.length > 6 ? ` and ${t.used.length - 6} more` : ''}</div>
            </div>
          ))}
        </div>
        {!big.length && !shown.length && <p className="muted">No table or column matches “{q}”.</p>}
      </div>
    </div>
  )
}
