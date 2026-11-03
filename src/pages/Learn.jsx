import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import booksIndex from '../content/books-index.json'
import guide from '../content/guide.json'
import til from '../content/til.json'
import Markdown from '../components/Markdown.jsx'
import { loadBook } from '../lib/books.js'
import { headings } from '../lib/md.js'
import { useProgress, toggleIn } from '../lib/progress.js'
import { PHASES } from '../data/path.js'

const ICON = { sql: '🗄️', spark: '⚡', lake: '🏞️', stream: '🌊' }

export default function Library() {
  const p = useProgress()
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div className="eyebrow">Learn</div>
          <h1>Handbooks</h1>
          <p>Four complete handbooks written from production experience, plus phase study guides for the Azure stack and short notes on real fixes. Mark chapters as read and your path updates.</p>
        </div>
        <div className="grid g2">
          {booksIndex.map((b) => {
            const done = b.chapters.filter((c) => p.chapters[`${b.slug}/${c.num}`]).length
            return (
              <Link key={b.slug} to={`/learn/${b.slug}`} className="card card-pad card-link">
                <div className="spread"><span style={{ fontSize: '1.8rem' }}>{ICON[b.icon]}</span><span className="chip">{b.chapters.length} chapters · ~{Math.round(b.minutes / 60)} h</span></div>
                <h2 style={{ marginTop: 12 }}>{b.title}</h2>
                <p className="muted">{b.subtitle}</p>
                <div className="row"><div className="progress" style={{ flex: 1 }}><i style={{ width: (100 * done / b.chapters.length) + '%' }} /></div><span className="small muted">{done}/{b.chapters.length}</span></div>
              </Link>
            )
          })}
        </div>
        <div className="section-head" style={{ marginTop: 44 }}>
          <h2>Phase study guides</h2>
          <p>What to study in each phase of the path, with code, must-know questions and what to say in interviews. Covers Azure Data Factory, ADLS Gen2, CI/CD and governance.</p>
        </div>
        <div className="grid g3">
          {guide.phases.map((g) => {
            const ph = PHASES.find((x) => x.n === g.n)
            return (
              <Link key={g.n} to={`/learn/azure/${g.n}`} className="card card-pad card-link" style={{ borderLeft: `4px solid ${ph.color}` }}>
                <div className="small muted">Phase {g.n} · weeks {ph.weeks}</div>
                <b>{g.title.replace(/^\S+\s/, '').replace(/^Phase \d+:\s*/, '')}</b>
              </Link>
            )
          })}
        </div>
        <div className="section-head" style={{ marginTop: 44 }}>
          <h2>Notes: one problem, one fix</h2>
        </div>
        <div className="grid g4">
          {til.map((t) => (
            <Link key={t.slug} to={`/notes/${t.slug}`} className="card card-pad card-link">
              <span className="chip" style={{ marginBottom: 8 }}>{t.topic}</span>
              <div><b>{t.title.replace(/`/g, '')}</b></div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Book() {
  const { book } = useParams()
  const p = useProgress()
  const b = booksIndex.find((x) => x.slug === book)
  if (!b) return <div className="page container">Handbook not found.</div>
  const next = b.chapters.find((c) => !p.chapters[`${b.slug}/${c.num}`]) || b.chapters[0]
  return (
    <div className="page">
      <div className="container narrow">
        <Link to="/learn" className="small">← All handbooks</Link>
        <div className="page-head" style={{ marginTop: 10 }}>
          <div className="eyebrow">{ICON[b.icon]} Handbook</div>
          <h1>{b.title}</h1>
          <p>{b.subtitle}. {b.chapters.length} chapters, about {Math.round(b.minutes / 60)} hours of reading.</p>
          <Link className="btn btn-primary" to={`/learn/${b.slug}/${next.slug}`}>{Object.keys(p.chapters).some((k) => k.startsWith(b.slug + '/')) ? 'Continue' : 'Start reading'}: {next.title}</Link>
        </div>
        <div className="card">
          {b.chapters.map((c) => {
            const done = p.chapters[`${b.slug}/${c.num}`]
            return (
              <Link key={c.num} to={`/learn/${b.slug}/${c.slug}`} className="linkrow" style={{ border: 0, borderBottom: '1px solid var(--line)', borderRadius: 0 }}>
                <span className="k" style={{ minWidth: 30 }}>{c.num}</span>
                <span style={{ flex: 1 }}>{c.title}</span>
                <span className="small muted">{c.minutes} min</span>
                {done && <span className="chip chip-ok">Read</span>}
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function useActiveHeading(ids) {
  const [active, setActive] = useState(null)
  useEffect(() => {
    if (!ids.length || typeof IntersectionObserver === 'undefined') return
    const obs = new IntersectionObserver((entries) => {
      const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis[0]) setActive(vis[0].target.id)
    }, { rootMargin: '-70px 0px -70% 0px' })
    const t = setTimeout(() => ids.forEach((id) => { const el = document.getElementById(id); if (el) obs.observe(el) }), 50)
    return () => { clearTimeout(t); obs.disconnect() }
  }, [ids.join('|')])
  return active
}

export function Chapter() {
  const { book, chapter } = useParams()
  const b = booksIndex.find((x) => x.slug === book)
  const [chs, setChs] = useState(null)
  const [side, setSide] = useState(false)
  const [focus, setFocus] = useState(() => { try { return localStorage.getItem('z2h:focus') === '1' } catch (e) { return false } })
  const [pct, setPct] = useState(0)
  const navigate = useNavigate()
  const p = useProgress()
  useEffect(() => { try { localStorage.setItem('z2h:focus', focus ? '1' : '0') } catch (e) { /* ignore */ } }, [focus])
  useEffect(() => {
    const on = () => { const h = document.documentElement; const max = h.scrollHeight - h.clientHeight; setPct(max > 0 ? Math.min(100, (100 * h.scrollTop) / max) : 0) }
    on(); window.addEventListener('scroll', on, { passive: true }); return () => window.removeEventListener('scroll', on)
  }, [chapter, chs])
  useEffect(() => { setChs(null); loadBook(book).then(setChs) }, [book])
  const idx = chs ? chs.findIndex((c) => c.slug === chapter) : -1
  const c = chs && idx >= 0 ? chs[idx] : null
  const hs = useMemo(() => (c ? headings(c.md).filter((h) => h.depth <= 4) : []), [c])
  const active = useActiveHeading(hs.map((h) => h.id))
  useEffect(() => { setSide(false) }, [chapter])
  if (!b) return <div className="page container">Handbook not found.</div>
  if (!chs) return <div className="page container"><span className="loading"><span className="spinner" /> Loading chapter…</span></div>
  if (!c) return <div className="page container">Chapter not found. <Link to={`/learn/${book}`}>Back to {b.title}</Link></div>
  const key = `${book}/${c.num}`
  const done = !!p.chapters[key]
  const prev = chs[idx - 1]
  const next = chs[idx + 1]
  return (
    <div className="container">
      <ReaderKeys prev={prev && `/learn/${book}/${prev.slug}`} next={next && `/learn/${book}/${next.slug}`} onFocus={() => setFocus((f) => !f)} navigate={navigate} onNext={() => { if (!done) toggleIn('chapters', key) }} />
      <div className="read-bar" style={{ width: pct + '%' }} />
      <div className={'reader' + (focus ? ' focus' : '')}>
        <aside className={'side' + (side ? ' open' : '')}>
          <h4><Link to={`/learn/${book}`}>{b.title}</Link></h4>
          {chs.map((x) => (
            <Link key={x.slug} to={`/learn/${book}/${x.slug}`} className={x.slug === chapter ? 'active' : ''}>
              <span className="n">{x.num}</span><span>{x.title}</span>{p.chapters[`${book}/${x.num}`] && <span className="tick">✓</span>}
            </Link>
          ))}
        </aside>
        <article>
          <div className="row small muted" style={{ marginBottom: 8 }}>
            <Link to={`/learn/${book}`}>{b.title}</Link><span>·</span><span>Chapter {c.num}</span><span>·</span><span>{c.minutes} min read</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setFocus((f) => !f)} style={{ marginLeft: 'auto' }} title="Focus mode (F)">{focus ? 'Exit focus' : 'Focus'}</button>
            <button className="btn btn-ghost btn-sm side-toggle" onClick={() => setSide((s) => !s)}>Chapters</button>
          </div>
          <div className="prose"><h1>{c.title}</h1></div>
          <Markdown md={c.md} />
          <div className="done-bar">
            <div><b>{done ? 'Nice. Chapter marked as read.' : 'Finished this chapter?'}</b><div className="small muted">Your path and progress update automatically.</div></div>
            <button className={'btn ' + (done ? 'btn-ghost' : 'btn-primary')} onClick={() => toggleIn('chapters', key)}>{done ? '✓ Read' : 'Mark as read'}</button>
          </div>
          <div className="chapter-foot">
            {prev ? <Link to={`/learn/${book}/${prev.slug}`} onClick={() => {}}><small>← Previous</small>{prev.title}</Link> : <span />}
            {next ? <Link className="next" to={`/learn/${book}/${next.slug}`} onClick={() => { if (!done) toggleIn('chapters', key) }}><small>Next →</small>{next.title}</Link> : <Link className="next" to="/learn"><small>Done →</small>Back to handbooks</Link>}
          </div>
        </article>
        <aside className="side toc-right">
          {hs.length > 0 && <h4>On this page</h4>}
          {hs.map((h, i) => (
            <a key={h.id + i} href="#" className={(h.depth === 4 ? 'lvl4 ' : '') + (active === h.id ? 'active' : '')}
              onClick={(e) => { e.preventDefault(); document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' }) }}>{h.text}</a>
          ))}
        </aside>
      </div>
    </div>
  )
}

export function GuidePhase() {
  const { phase } = useParams()
  const g = guide.phases.find((x) => x.n === Number(phase))
  if (!g) return <div className="page container">Not found.</div>
  const ph = PHASES.find((x) => x.n === g.n)
  const prev = guide.phases.find((x) => x.n === g.n - 1)
  const next = guide.phases.find((x) => x.n === g.n + 1)
  const clean = (t) => t.replace(/^\S+\s/, '').replace(/^Phase \d+:\s*/, '')
  return (
    <div className="page">
      <div className="container narrow">
        <Link to="/path" className="small">← The path</Link>
        <div className="page-head" style={{ marginTop: 10 }}>
          <div className="eyebrow" style={{ color: ph.color }}>Phase {g.n} study guide · weeks {ph.weeks}</div>
          <h1>{clean(g.title)}</h1>
        </div>
        <Markdown md={g.md} />
        <div className="chapter-foot">
          {prev ? <Link to={`/learn/azure/${prev.n}`}><small>← Phase {prev.n}</small>{clean(prev.title)}</Link> : <span />}
          {next ? <Link className="next" to={`/learn/azure/${next.n}`}><small>Phase {next.n} →</small>{clean(next.title)}</Link> : <span />}
        </div>
      </div>
    </div>
  )
}

function ReaderKeys({ prev, next, onFocus, navigate, onNext }) {
  useEffect(() => {
    const k = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return
      if (e.key === 'f' || e.key === 'F') onFocus()
      else if (e.key === 'ArrowRight' && next) { onNext(); navigate(next) }
      else if (e.key === 'ArrowLeft' && prev) navigate(prev)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [prev, next, onFocus, navigate, onNext])
  return null
}
