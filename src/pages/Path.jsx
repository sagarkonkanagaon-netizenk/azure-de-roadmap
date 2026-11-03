import { Link, useParams } from 'react-router-dom'
import booksIndex from '../content/books-index.json'
import guide from '../content/guide.json'
import { PHASES, WEEKS, TIMETABLE } from '../data/path.js'
import { DRILLS } from '../data/drills.js'
import { useProgress, toggleIn } from '../lib/progress.js'

export function resolveRef(ref) {
  const [book, num] = ref.split(':')
  if (book === 'guide') {
    const ph = guide.phases.find((p) => p.n === Number(num))
    return { to: `/learn/azure/${num}`, title: ph.title.replace(/^\S+\s/, ''), book: 'Azure notes', key: null, minutes: 15 }
  }
  const b = booksIndex.find((x) => x.slug === book)
  const c = b.chapters.find((x) => x.num === Number(num))
  return { to: `/learn/${book}/${c.slug}`, title: c.title, book: b.title, key: `${book}/${c.num}`, minutes: c.minutes }
}

export function practiceLink(pr) {
  if (pr.kind === 'sql') return `/practice/sql/${pr.from}`
  if (pr.kind === 'py') return `/practice/python/${pr.from}`
  if (pr.kind === 'spark') return `/interview/pyspark#q${pr.from}`
  if (pr.kind === 'drill') return `/drills/${pr.id}`
  if (pr.kind === 'flash') return '/interview/flashcards'
  if (pr.kind === 'scenarios') return '/interview/scenarios'
  if (pr.kind === 'playbook') return '/interview/playbook'
  return '/'
}

function practiceDone(pr, p) {
  if (pr.kind === 'sql' || pr.kind === 'py' || pr.kind === 'spark') {
    const area = pr.kind === 'spark' ? 'spark' : pr.kind
    let n = 0
    for (let i = pr.from; i <= pr.to; i++) if (p[area][i] === 'solved' || p[area][i] === 'known') n++
    return { n, total: pr.to - pr.from + 1 }
  }
  if (pr.kind === 'drill') return { n: p.drills[pr.id] ? 1 : 0, total: 1 }
  return null
}

export function weekStats(w, p) {
  const checks = w.checks.filter((_, i) => p.checks[`w${w.n}:${i}`]).length
  const reads = w.read.map(resolveRef).filter((r) => r.key)
  const readDone = reads.filter((r) => p.chapters[r.key]).length
  return { checks, readDone, reads: reads.length, pct: Math.round(100 * (checks + readDone) / (w.checks.length + reads.length || 1)) }
}

export function weekDone(w, p) { return weekStats(w, p).pct === 100 }

export default function Path() {
  const p = useProgress()
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div className="eyebrow">The 12-week path</div>
          <h1>Zero to hero in twelve weeks</h1>
          <p>About 22 hours a week: two and a half hours on weekdays, five on weekends. Each week has reading, practice, one build task and a checklist. Code more than you watch: aim for 80% hands-on.</p>
        </div>
        <div className="stack">
          {PHASES.map((ph) => (
            <div key={ph.n} className="phase">
              <span className="dot" style={{ background: ph.color }}>{ph.n}</span>
              <div className="spread" style={{ marginBottom: 10 }}>
                <div>
                  <div className="small muted">Phase {ph.n} · weeks {ph.weeks}</div>
                  <h2 style={{ margin: 0 }}>{ph.title}</h2>
                </div>
                <Link to={`/learn/azure/${ph.guide}`} className="btn btn-ghost btn-sm">Phase study guide</Link>
              </div>
              <div className="grid g2" style={{ marginBottom: 28 }}>
                {WEEKS.filter((w) => w.phase === ph.n).map((w) => {
                  const s = weekStats(w, p)
                  return (
                    <Link key={w.n} to={`/path/${w.n}`} className="card week-card card-link">
                      <div className="spread"><span className="chip">Week {w.n}</span>{s.pct === 100 ? <span className="chip chip-ok">Done</span> : s.pct > 0 ? <span className="chip chip-primary">{s.pct}%</span> : null}</div>
                      <h3 style={{ marginTop: 10 }}>{w.title}</h3>
                      <p className="muted small" style={{ margin: '0 0 12px' }}>{w.goal}</p>
                      <div className="progress"><i style={{ width: s.pct + '%' }} /></div>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="section-head" style={{ marginTop: 20 }}>
          <div className="eyebrow">Timetable</div>
          <h2>A realistic week for working people</h2>
        </div>
        <div className="grid g2">
          {[['Weekdays (Mon–Fri) · ~2.5 h', TIMETABLE.weekday], ['Weekends · ~5 h a day', TIMETABLE.weekend]].map(([t, rows]) => (
            <div key={t} className="card card-pad">
              <h3>{t}</h3>
              <div className="table-wrap" style={{ margin: 0 }}>
                <table className="rtable" style={{ fontFamily: 'var(--font)' }}>
                  <tbody>{rows.map((r) => <tr key={r[0]}><td style={{ fontFamily: 'var(--mono)' }}>{r[0]}</td><td><b>{r[1]}</b><div className="muted" style={{ whiteSpace: 'normal' }}>{r[2]}</div></td></tr>)}</tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Week() {
  const { week } = useParams()
  const p = useProgress()
  const w = WEEKS.find((x) => x.n === Number(week))
  if (!w) return <div className="page container">Week not found.</div>
  const ph = PHASES.find((x) => x.n === w.phase)
  const s = weekStats(w, p)
  const prev = WEEKS.find((x) => x.n === w.n - 1)
  const next = WEEKS.find((x) => x.n === w.n + 1)
  return (
    <div className="page">
      <div className="container narrow">
        <Link to="/path" className="small">← All weeks</Link>
        <div className="page-head" style={{ marginTop: 10 }}>
          <div className="eyebrow" style={{ color: ph.color }}>Week {w.n} · Phase {ph.n}: {ph.title}</div>
          <h1>{w.title}</h1>
          <p>{w.goal}</p>
          <div className="row" style={{ maxWidth: 420 }}><div className="progress" style={{ flex: 1 }}><i style={{ width: s.pct + '%' }} /></div><span className="small muted">{s.pct}%</span></div>
        </div>

        <h3>1. Read</h3>
        <div className="stack" style={{ marginBottom: 28 }}>
          {w.read.map((ref) => {
            const r = resolveRef(ref)
            const done = r.key && p.chapters[r.key]
            return (
              <Link key={ref} to={r.to} className="linkrow">
                <span className="k">{r.book.split(' ')[0]}</span>
                <span style={{ flex: 1 }}>{r.title}</span>
                <span className="small muted">{r.minutes} min</span>
                {done ? <span className="chip chip-ok">Read</span> : null}
              </Link>
            )
          })}
        </div>

        <h3>2. Practise</h3>
        <div className="stack" style={{ marginBottom: 28 }}>
          {w.practice.map((pr, i) => {
            const d = practiceDone(pr, p)
            const drill = pr.kind === 'drill' ? DRILLS.find((x) => x.id === pr.id) : null
            return (
              <Link key={i} to={practiceLink(pr)} className="linkrow">
                <span className="k">{pr.kind === 'drill' ? 'Incident' : pr.kind === 'flash' ? 'Cards' : pr.kind === 'spark' ? 'PySpark' : pr.kind === 'py' ? 'Python' : pr.kind === 'sql' ? 'SQL' : 'Interview'}</span>
                <span style={{ flex: 1 }}>{drill ? `Incident drill: ${drill.title}` : pr.label}</span>
                {d && <span className={'chip ' + (d.n === d.total ? 'chip-ok' : '')}>{d.n}/{d.total}</span>}
              </Link>
            )
          })}
        </div>

        <h3>3. Build</h3>
        <div className="card card-pad" style={{ marginBottom: 28, borderLeft: `4px solid ${ph.color}` }}>{w.build}</div>

        <h3>4. Checklist</h3>
        <div className="card card-pad">
          <ul className="checklist">
            {w.checks.map((c, i) => {
              const k = `w${w.n}:${i}`
              return (
                <li key={k} className={p.checks[k] ? 'done' : ''}>
                  <input id={k} type="checkbox" checked={!!p.checks[k]} onChange={() => toggleIn('checks', k)} />
                  <label htmlFor={k}>{c}</label>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="chapter-foot">
          {prev ? <Link to={`/path/${prev.n}`}><small>← Week {prev.n}</small>{prev.title}</Link> : <span />}
          {next ? <Link className="next" to={`/path/${next.n}`}><small>Week {next.n} →</small>{next.title}</Link> : <Link className="next" to="/progress"><small>Finish →</small>See your progress</Link>}
        </div>
      </div>
    </div>
  )
}
