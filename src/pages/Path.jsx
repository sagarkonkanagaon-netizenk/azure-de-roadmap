import { Link, useParams } from 'react-router-dom'
import booksIndex from '../content/books-index.json'
import guide from '../content/guide.json'
import { PHASES, WEEKS, TIMETABLE, PATH } from '../data/path.js'
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
  if (pr.kind === 'visual') return '/visual'
  if (pr.kind === 'quiz') return '/interview/quiz'
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

// v2 prefix: the 24-week path replaced the 12-week one, so old ticks must not land on new weeks.
export const checkKey = (week, i) => `v2w${week}:${i}`

export function phaseStats(ph, p) {
  const ws = WEEKS.filter((w) => w.phase === ph.n)
  const done = ws.filter((w) => weekDone(w, p)).length
  return { done, total: ws.length, pct: Math.round(ws.reduce((a, w) => a + weekStats(w, p).pct, 0) / ws.length) }
}

export function weekStats(w, p) {
  const checks = w.checks.filter((_, i) => p.checks[checkKey(w.n, i)]).length
  const reads = w.read.map(resolveRef).filter((r) => r.key)
  const readDone = reads.filter((r) => p.chapters[r.key]).length
  return { checks, readDone, reads: reads.length, pct: Math.round(100 * (checks + readDone) / (w.checks.length + reads.length || 1)) }
}

export function weekDone(w, p) { return weekStats(w, p).pct === 100 }

export default function Path() {
  const p = useProgress()
  const doneWeeks = WEEKS.filter((w) => weekDone(w, p)).length
  const current = WEEKS.find((w) => !weekDone(w, p)) || WEEKS[WEEKS.length - 1]
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div className="eyebrow">The {PATH.weeks}-week path</div>
          <h1>Zero to data engineer in {PATH.months} months</h1>
          <p>Honest and doable: about {PATH.hours} hours a week, around a job or college. You join {PATH.company}, a made-up food-delivery startup, as its new data engineer. Every week is a real-feeling ticket from your lead, and every stop on the highway ends with a boss build for your portfolio.</p>
        </div>

        <div className="path-stats">
          {[[PATH.weeks, 'weeks'], [PHASES.length, 'stops'], [PHASES.length, 'boss builds'], [WEEKS.length * 5, 'daily tasks']].map(([n, l]) => <div key={l} className="path-stat"><b>{n}</b><span>{l}</span></div>)}
        </div>

        <div className="highway" aria-label="Your progress along the path">
          {PHASES.map((ph) => {
            const st = phaseStats(ph, p)
            const here = current.phase === ph.n && doneWeeks < WEEKS.length
            return (
              <a key={ph.n} href={`#stop-${ph.n}`} className={'hw-stop' + (st.done === st.total ? ' done' : '') + (here ? ' here' : '')} style={{ '--c': ph.color }}>
                <span className="hw-dot">{st.done === st.total ? '✓' : ph.n}</span>
                <span className="hw-name">{ph.title}</span>
                <span className="hw-badge">{st.done === st.total ? ph.badge : `${st.done}/${st.total} weeks`}</span>
              </a>
            )
          })}
        </div>

        <Link to={`/path/${current.n}`} className="card card-pad card-link path-next" style={{ '--c': PHASES[current.phase - 1].color }}>
          <span className="basic-k">{doneWeeks ? 'Continue' : 'Start here'} · Week {current.n}</span>
          <h3>{current.title}</h3>
          <p className="muted">{current.story}</p>
          <span className="hub-go">Open week {current.n} →</span>
        </Link>

        <div className="stack">
          {PHASES.map((ph) => {
            const st = phaseStats(ph, p)
            return (
              <div key={ph.n} id={`stop-${ph.n}`} className="phase">
                <span className="dot" style={{ background: ph.color }}>{ph.n}</span>
                <div className="spread" style={{ marginBottom: 10 }}>
                  <div>
                    <div className="small muted">Stop {ph.n} · weeks {ph.weeks} · badge: <b style={{ color: ph.color }}>{ph.badge}</b>{st.done === st.total ? ' ✓' : ''}</div>
                    <h2 style={{ margin: 0 }}>{ph.title}</h2>
                  </div>
                  <Link to={`/learn/azure/${ph.guide}`} className="btn btn-ghost btn-sm">Study guide</Link>
                </div>
                <div className="grid g3" style={{ marginBottom: 12 }}>
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
                <div className="boss" style={{ '--c': ph.color }}><span className="boss-k">Boss build</span>{ph.boss}</div>
              </div>
            )
          })}
        </div>

        <div className="section-head" style={{ marginTop: 28 }}>
          <div className="eyebrow">Your week</div>
          <h2>About {PATH.hours} hours, built for busy people</h2>
        </div>
        <div className="grid g2">
          {[['Weekdays · about 80 minutes', TIMETABLE.weekday], ['Weekends · about 3 hours a day', TIMETABLE.weekend]].map(([t, rows]) => (
            <div key={t} className="card card-pad">
              <h3>{t}</h3>
              <div className="table-wrap" style={{ margin: 0 }}>
                <table className="rtable" style={{ fontFamily: 'var(--font)' }}>
                  <tbody>{rows.map((r) => <tr key={r[1]}><td style={{ fontFamily: 'var(--mono)' }}>{r[0]}</td><td><b>{r[1]}</b><div className="muted" style={{ whiteSpace: 'normal' }}>{r[2]}</div></td></tr>)}</tbody>
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
          <div className="eyebrow" style={{ color: ph.color }}>Week {w.n} of {WEEKS.length} · Stop {ph.n}: {ph.title}</div>
          <h1>{w.title}</h1>
          <p>{w.goal}</p>
          <div className="row" style={{ maxWidth: 420 }}><div className="progress" style={{ flex: 1 }}><i style={{ width: s.pct + '%' }} /></div><span className="small muted">{s.pct}%</span></div>
        </div>

        <div className="ticket" style={{ '--c': ph.color }}>
          <span className="ticket-k">Ticket from your lead at {PATH.company}</span>
          <p>{w.story}</p>
        </div>

        <h3>Your week, day by day</h3>
        <ol className="days" style={{ marginBottom: 28 }}>
          {w.days.map((d, i) => <li key={i}><span className="day-k">{['Mon', 'Tue', 'Wed', 'Thu', 'Sat–Sun'][i]}</span><span>{d}</span></li>)}
        </ol>

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
        <div className={w.build.startsWith('Boss build') ? 'boss' : 'card card-pad'} style={{ marginBottom: 28, '--c': ph.color, ...(w.build.startsWith('Boss build') ? {} : { borderLeft: `4px solid ${ph.color}` }) }}>
          {w.build.startsWith('Boss build') ? <><span className="boss-k">Boss build · earns the {ph.badge} badge</span>{w.build.replace(/^Boss build: (.)/, (_, c) => c.toUpperCase())}</> : w.build}
        </div>

        <h3>4. Checklist</h3>
        <div className="card card-pad">
          <ul className="checklist">
            {w.checks.map((c, i) => {
              const k = checkKey(w.n, i)
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
