import { Link, useParams } from 'react-router-dom'
import Markdown from '../components/Markdown.jsx'
import { SHEETS } from '../pro/cheatsheets.js'
import { NotFound } from './Misc.jsx'

export function SheetIndex() {
  return (
    <div className="page">
      <div className="container">
        <Link to="/pro" className="small">← Data Dhaba Pro</Link>
        <div className="page-head" style={{ marginTop: 14 }}>
          <div className="eyebrow">Cheat sheets <span className="chip chip-ok">Free preview</span></div>
          <h1>One page. Everything you need.</h1>
          <p>Print them, pin them, revise from them the night before an interview. {SHEETS.length} are free here, and Pro adds 60+ more.</p>
        </div>
        <div className="grid g3">
          {SHEETS.map((s) => (
            <Link key={s.slug} to={`/pro/cheatsheets/${s.slug}`} className="card card-pad card-link sheet-card">
              <span className="chip">{s.tag}</span>
              <h3>{s.title}</h3>
              <span className="small muted">Open and print →</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Sheet() {
  const { slug } = useParams()
  const i = SHEETS.findIndex((s) => s.slug === slug)
  if (i < 0) return <NotFound />
  const s = SHEETS[i]
  const next = SHEETS[(i + 1) % SHEETS.length]
  return (
    <div className="page sheet-page">
      <div className="container">
        <div className="spread no-print">
          <Link to="/pro/cheatsheets" className="small">← All cheat sheets</Link>
          <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>Print or save as PDF</button>
        </div>
        <article className="sheet">
          <header className="sheet-head">
            <div><span className="sheet-brand">data<b>dhaba</b> · cheat sheet</span><h1>{s.title}</h1></div>
            <span className="chip">{s.tag}</span>
          </header>
          <Markdown md={s.md} className="prose sheet-body no-try" />
          <footer className="sheet-foot">datadhaba.in · free to print and share</footer>
        </article>
        <div className="row no-print" style={{ justifyContent: 'space-between', marginTop: 20, flexWrap: 'wrap' }}>
          <Link className="btn btn-ghost" to={`/pro/cheatsheets/${next.slug}`}>Next: {next.title} →</Link>
          <Link className="btn btn-primary" to="/pro">60+ more in Pro</Link>
        </div>
      </div>
    </div>
  )
}
