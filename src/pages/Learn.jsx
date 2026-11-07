import { pdfFor } from '../data/pdfs.jsx'
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
import Waitlist from '../components/Waitlist.jsx'

// The seven study guides came before the 24-week path; each one belongs to the stop that teaches its topic.
const GUIDE_STOP = { 1: 1, 2: 3, 3: 5, 4: 4, 5: 6, 6: 7, 7: 8 }
const guideStop = (n) => PHASES.find((x) => x.n === GUIDE_STOP[n]) || PHASES[0]

const ICON = { sql: '🗄️', py: '🐍', spark: '⚡', lake: '🏞️', stream: '🌊' }
// Reading time as people say it: "45 min", "about 2 h".
export const readTime = (m) => (m < 75 ? `${m} min` : `about ${Math.round(m / 60)} h`)

export default function Library() {
  const p = useProgress()
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div className="eyebrow">Learn</div>
          <h1>Learn the ideas, one step at a time</h1>
          <p>Not sure where to begin? Follow the 24-week path. It tells you what to read and practise each week, using the handbooks below.</p>
        </div>
        <div className="grid g3 learn-ways">
          <Link to="/path" className="card hub-card card-link hub-main">
            <span className="basic-k">Recommended start</span>
            <h3>The 24-week path</h3>
            <p>A weekly plan from SQL basics to cloud pipelines, with a checklist for each week.</p>
            <span className="hub-go">Open the path →</span>
          </Link>
          <Link to="/visual" className="card hub-card card-link">
            <span className="basic-k">See it</span>
            <h3>Visual SQL</h3>
            <p>Watch joins and window functions work, row by row, before you write them.</p>
            <span className="hub-go">Open →</span>
          </Link>
          <Link to="/notes" className="card hub-card card-link">
            <span className="basic-k">Keep it</span>
            <h3>Notes and PDFs</h3>
            <p>Download the handbooks and notes as PDFs to read offline.</p>
            <span className="hub-go">Open →</span>
          </Link>
        </div>
        <div className="section-head" style={{ marginTop: 44 }}>
          <h2>Handbooks</h2>
          <p>Five complete handbooks written from production experience. Mark chapters as read and your path updates.</p>
        </div>
        <div className="grid g2">
          {booksIndex.map((b) => {
            const done = b.chapters.filter((c) => p.chapters[`${b.slug}/${c.num}`]).length
            return (
              <Link key={b.slug} to={`/learn/${b.slug}`} className="card card-pad card-link">
                <div className="spread"><span style={{ fontSize: '1.8rem' }}>{ICON[b.icon]}</span><span className="chip">{b.chapters.length} chapters · {readTime(b.minutes)}</span></div>
                <h3 style={{ marginTop: 12, fontSize: '1.3rem' }}>{b.title}</h3>
                <p className="muted">{b.subtitle}</p>
                {b.deep && <p className="small deep-note"><span className="chip chip-pro">Pro</span> {b.deep.length} deep dives</p>}
                <div className="row"><div className="progress" style={{ flex: 1 }}><i style={{ width: (100 * done / b.chapters.length) + '%' }} /></div><span className="small muted">{done}/{b.chapters.length}</span></div>
              </Link>
            )
          })}
        </div>
        <div className="section-head" style={{ marginTop: 44 }}>
          <h2>Study guides</h2>
          <p>Seven deep-dive guides that sit alongside the path, with code, must-know questions and what to say in interviews. Covers Azure Data Factory, ADLS Gen2, CI/CD and governance.</p>
        </div>
        <div className="grid g3">
          {guide.phases.map((g) => {
            const ph = guideStop(g.n)
            return (
              <Link key={g.n} to={`/learn/azure/${g.n}`} className="card card-pad card-link" style={{ borderLeft: `4px solid ${ph.color}` }}>
                <div className="small muted">Guide {g.n} · goes with stop {ph.n}, weeks {ph.weeks}</div>
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
          <p>{b.subtitle}. {b.chapters.length} chapters, {readTime(b.minutes)} of reading.</p>
          <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
            <Link className="btn btn-primary" to={`/learn/${b.slug}/${next.slug}`}>{Object.keys(p.chapters).some((k) => k.startsWith(b.slug + '/')) ? 'Continue' : 'Start reading'}: {next.title}</Link>
            {pdfFor(b.slug) && <a className="btn btn-ghost" href={pdfFor(b.slug).url} download target="_blank" rel="noreferrer">↓ Download PDF ({pdfFor(b.slug).pages} pages)</a>}
          </div>
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
        {b.deep && (
          <>
            <div className="section-head" style={{ marginTop: 32 }}>
              <h2>Pro deep dives</h2>
              <p>Longer pieces that go past the handbook: the internals, the production patterns and the interview answers. Each one opens with a preview you can read now.</p>
            </div>
            <div className="card">
              {b.deep.map((d) => (
                <Link key={d.slug} to={`/learn/${b.slug}/${d.slug}`} className="linkrow" style={{ border: 0, borderBottom: '1px solid var(--line)', borderRadius: 0 }}>
                  <span className="k" style={{ minWidth: 30 }} aria-hidden="true">🔒</span>
                  <span style={{ flex: 1 }}>{d.title}</span>
                  <span className="small muted">{d.sections} sections</span>
                  <span className="chip chip-pro">Pro</span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// What a Pro deep dive holds after the preview, and the way in.
function ProLock({ items }) {
  return (
    <section className="pro-lock" aria-label="The rest of this deep dive is part of Pro">
      <div className="pro-lock-fade" aria-hidden="true" />
      <div className="pro-lock-card">
        <div className="eyebrow"><span className="chip chip-pro">Pro</span> The rest of this deep dive</div>
        <h2>You've read the preview. Here's what comes next.</h2>
        <ol className="pro-lock-list">
          {items.map((t) => <li key={t}><span aria-hidden="true">🔒</span>{t}</li>)}
        </ol>
        <p className="muted">Pro opens soon. Join the waitlist and we'll email you the day it does.</p>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          <Link className="btn btn-ghost" to="/pro">See what Pro includes</Link>
        </div>
        <Waitlist />
      </div>
    </section>
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
  // Pro deep dives share numbers with chapters, so they never touch reading progress.
  const key = c.pro ? null : `${book}/${c.num}`
  const done = !key || !!p.chapters[key]
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
              <span className="n">{x.pro ? '🔒' : x.num}</span><span>{x.title}</span>{x.pro ? <span className="tick pro-tick">Pro</span> : p.chapters[`${book}/${x.num}`] && <span className="tick">✓</span>}
            </Link>
          ))}
        </aside>
        <article>
          <div className="row small muted" style={{ marginBottom: 8 }}>
            <Link to={`/learn/${book}`}>{b.title}</Link><span>·</span>{c.pro ? <span className="chip chip-pro">Pro deep dive {c.num}</span> : <><span>Chapter {c.num}</span><span>·</span><span>{c.minutes} min read</span></>}
            <button className="btn btn-ghost btn-sm" onClick={() => setFocus((f) => !f)} style={{ marginLeft: 'auto' }} title="Focus mode (F)">{focus ? 'Exit focus' : 'Focus'}</button>
            <button className="btn btn-ghost btn-sm side-toggle" onClick={() => setSide((s) => !s)}>Chapters</button>
          </div>
          <div className="prose"><h1>{c.title}</h1></div>
          <Markdown md={c.md} />
          {c.pro ? <ProLock items={c.locked} /> : <div className="done-bar">
            <div><b>{done ? 'Nice. Chapter marked as read.' : 'Finished this chapter?'}</b><div className="small muted">Your path and progress update automatically.</div></div>
            <button className={'btn ' + (done ? 'btn-ghost' : 'btn-primary')} onClick={() => toggleIn('chapters', key)}>{done ? '✓ Read' : 'Mark as read'}</button>
          </div>}
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
  const ph = guideStop(g.n)
  const prev = guide.phases.find((x) => x.n === g.n - 1)
  const next = guide.phases.find((x) => x.n === g.n + 1)
  const clean = (t) => t.replace(/^\S+\s/, '').replace(/^Phase \d+:\s*/, '')
  return (
    <div className="page">
      <div className="container narrow">
        <Link to="/path" className="small">← The path</Link>
        <div className="page-head" style={{ marginTop: 10 }}>
          <div className="eyebrow stop-tint" style={{ '--c': ph.color }}>Study guide {g.n} · stop {ph.n}, weeks {ph.weeks}</div>
          <h1>{clean(g.title)}</h1>
        </div>
        <Markdown md={g.md} />
        <div className="chapter-foot">
          {prev ? <Link to={`/learn/azure/${prev.n}`}><small>← Guide {prev.n}</small>{clean(prev.title)}</Link> : <span />}
          {next ? <Link className="next" to={`/learn/azure/${next.n}`}><small>Guide {next.n} →</small>{clean(next.title)}</Link> : <span />}
        </div>
      </div>
    </div>
  )
}

function ReaderKeys({ prev, next, onFocus, navigate, onNext }) {
  useEffect(() => {
    const k = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable || document.activeElement?.closest('.cm-editor')) return
      if (e.key === 'f' || e.key === 'F') onFocus()
      else if (e.key === 'ArrowRight' && next) { onNext(); navigate(next) }
      else if (e.key === 'ArrowLeft' && prev) navigate(prev)
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [prev, next, onFocus, navigate, onNext])
  return null
}
