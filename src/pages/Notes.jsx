import { Link, useParams } from 'react-router-dom'
import til from '../content/til.json'
import Markdown from '../components/Markdown.jsx'
import { PdfGrid } from '../data/pdfs.jsx'

export default function Notes() {
  const topics = [...new Set(til.map((t) => t.topic))]
  return (
    <div className="page">
      <div className="container narrow">
        <div className="page-head">
          <div className="eyebrow">Notes</div>
          <h1>Download the <em>notes</em></h1>
          <p>Sagar's original handbooks and interview notes as PDFs. Free to download, print and keep offline.</p>
        </div>
        <PdfGrid />
        <div className="page-head" style={{ marginTop: 40 }}>
          <h2 style={{ margin: 0 }}>Today I learned</h2>
          <p>Short, practical notes from building pipelines. One problem, one fix, and code you can paste.</p>
        </div>
        {topics.map((t) => (
          <div key={t} style={{ marginBottom: 24 }}>
            <h3 style={{ textTransform: 'capitalize' }}>{t}</h3>
            <div className="stack">{til.filter((x) => x.topic === t).map((x) => <Link key={x.slug} to={`/notes/${x.slug}`} className="linkrow"><span style={{ flex: 1 }}>{x.title.replace(/`/g, '')}</span><span className="muted">→</span></Link>)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Note() {
  const { slug } = useParams()
  const i = til.findIndex((x) => x.slug === slug)
  const t = til[i]
  if (!t) return <div className="page container">Note not found.</div>
  const next = til[i + 1]
  return (
    <div className="page">
      <div className="container narrow">
        <Link to="/notes" className="small">← All notes</Link>
        <div className="prose" style={{ marginTop: 10 }}><span className="chip">{t.topic}</span><h1 style={{ marginTop: 10 }}>{t.title.replace(/`/g, '')}</h1></div>
        <Markdown md={t.md} />
        <div className="chapter-foot"><Link to="/notes"><small>←</small>All notes</Link>{next && <Link className="next" to={`/notes/${next.slug}`}><small>Next →</small>{next.title.replace(/`/g, '')}</Link>}</div>
      </div>
    </div>
  )
}
