import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import MiniSearch from 'minisearch'
import booksIndex from '../content/books-index.json'
import sqlQ from '../content/sql-questions.json'
import pyQ from '../content/py-questions.json'
import scen from '../content/scenarios.json'
import til from '../content/til.json'
import { WEEKS } from '../data/path.js'
import { loadBook } from '../lib/books.js'

let indexPromise = null
async function buildIndex() {
  const docs = []
  let id = 0
  for (const b of booksIndex) {
    const chapters = await loadBook(b.slug)
    for (const c of chapters) {
      docs.push({ id: id++, title: c.title, kind: b.title, body: c.md.replace(/```[\s\S]*?```/g, ' ').slice(0, 6000), to: `/learn/${b.slug}/${c.slug}` })
    }
  }
  for (const q of sqlQ.questions) docs.push({ id: id++, title: q.title, kind: 'SQL lab', body: q.note + ' ' + q.given, to: `/practice/sql/${q.n}` })
  for (const q of pyQ.questions) docs.push({ id: id++, title: q.title, kind: q.section === 'PySpark' ? 'PySpark question' : 'Python lab', body: q.note, to: q.section === 'PySpark' ? `/interview/pyspark#q${q.n}` : `/practice/python/${q.n}` })
  for (const s of scen.sections) for (const q of s.questions) docs.push({ id: id++, title: q.title, kind: 'Scenario', body: q.answer, to: `/interview/scenarios#q${q.n}` })
  for (const t of til) docs.push({ id: id++, title: t.title, kind: 'Note', body: t.md, to: `/notes/${t.slug}` })
  for (const w of WEEKS) docs.push({ id: id++, title: `Week ${w.n}: ${w.title}`, kind: 'Path', body: w.goal, to: `/path/${w.n}` })
  const ms = new MiniSearch({ fields: ['title', 'body', 'kind'], storeFields: ['title', 'kind', 'to'], searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.15 } })
  ms.addAll(docs)
  return ms
}

export default function Search({ onClose }) {
  const [q, setQ] = useState('')
  const [ms, setMs] = useState(null)
  const [sel, setSel] = useState(0)
  const input = useRef(null)
  const navigate = useNavigate()
  useEffect(() => {
    input.current?.focus()
    if (!indexPromise) indexPromise = buildIndex()
    indexPromise.then(setMs)
  }, [])
  const results = useMemo(() => (ms && q.trim() ? ms.search(q).slice(0, 12) : []), [ms, q])
  useEffect(() => setSel(0), [q])
  const onKey = (e) => {
    if (e.key === 'Escape') onClose()
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && results[sel]) { navigate(results[sel].to); onClose() }
  }
  return (
    <div className="overlay" onClick={onClose}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input ref={input} className="input" placeholder="Search chapters, questions, notes…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} aria-label="Search" />
        <ul>
          {!ms && <li className="empty"><span className="loading"><span className="spinner" /> Building the index…</span></li>}
          {ms && q && !results.length && <li className="empty">No results for “{q}”.</li>}
          {ms && !q && <li className="empty small">Try “watermark”, “SCD”, “skew”, “top 3 salaries”, “Unity Catalog”.</li>}
          {results.map((r, i) => (
            <li key={r.id}><Link to={r.to} className={i === sel ? 'sel' : ''} onClick={onClose}><small>{r.kind}</small>{r.title}</Link></li>
          ))}
        </ul>
      </div>
    </div>
  )
}
