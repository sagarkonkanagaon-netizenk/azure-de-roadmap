import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import sqlQ from '../content/sql-questions.json'
import booksIndex from '../content/books-index.json'
import { WEEKS } from '../data/path.js'
import { DRILLS } from '../data/drills.js'
import { useProgress, streak } from '../lib/progress.js'
import { tally, levelOf } from '../lib/xp.js'
import { weekStats } from '../pages/Path.jsx'

const PKEY = 'z2h:profile'
export function getProfile() { try { return JSON.parse(localStorage.getItem(PKEY)) || null } catch (e) { return null } }
function setProfile(v) { try { localStorage.setItem(PKEY, JSON.stringify(v)) } catch (e) { /* ignore */ } }

const QS = [
  { k: 'start', q: 'Where are you starting from?', opts: [['new', 'New to data', 'I am learning SQL from scratch'], ['sql', 'I know SQL', 'Queries are fine, Spark is new'], ['de', 'Already in data', 'I want cloud, Databricks and interviews']] },
  { k: 'goal', q: 'What do you want most?', opts: [['job', 'My first DE job', 'Switch careers or land a first role'], ['better', 'A better offer', 'Move up from where I am'], ['skills', 'Just the skills', 'Learn properly, no rush']] },
  { k: 'time', q: 'How much time do you have?', opts: [['light', 'About 1 hour a day', 'Steady and sustainable'], ['normal', 'About 2 hours a day', 'The plan as written'], ['sprint', '4+ hours a day', 'Interview in a few weeks']] },
]

export function startWeek(profile) {
  if (!profile) return 1
  if (profile.start === 'de') return profile.goal === 'skills' ? 5 : 7
  if (profile.start === 'sql') return 3
  return 1
}

export function Onboarding({ onClose }) {
  const [i, setI] = useState(0)
  const [ans, setAns] = useState({})
  const navigate = useNavigate()
  const q = QS[i]
  const pick = (v) => {
    const next = { ...ans, [q.k]: v }
    setAns(next)
    if (i + 1 < QS.length) setI(i + 1)
    else { setProfile(next); onClose(); navigate(`/path/${startWeek(next)}`) }
  }
  return (
    <div className="levelup" role="dialog" aria-label="Find your starting point" onClick={onClose}>
      <div className="levelup-card onboard" onClick={(e) => e.stopPropagation()}>
        <div className="spread small muted"><span className="eyebrow" style={{ margin: 0 }}>Step {i + 1} of {QS.length}</span><button className="btn btn-ghost btn-sm" onClick={onClose}>Skip</button></div>
        <div className="progress" style={{ margin: '14px 0 18px' }}><i style={{ width: ((i + 1) / QS.length) * 100 + '%' }} /></div>
        <h2 style={{ textAlign: 'left' }}>{q.q}</h2>
        <div className="stack" style={{ gap: 8 }}>
          {q.opts.map(([v, t, d]) => (
            <button key={v} className="opt" onClick={() => pick(v)}><span className="opt-l">→</span><span><b>{t}</b><br /><span className="small muted">{d}</span></span></button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Mission() {
  const p = useProgress()
  const t = tally(p)
  const lv = levelOf(t.xp)
  const s = streak(p.days)
  const week = WEEKS.find((w) => weekStats(w, p).pct < 100) || WEEKS[WEEKS.length - 1]
  const book = booksIndex.find((b) => b.chapters.some((c) => !p.chapters[`${b.slug}/${c.num}`])) || booksIndex[0]
  const ch = book.chapters.find((c) => !p.chapters[`${book.slug}/${c.num}`]) || book.chapters[0]
  const q = sqlQ.questions.find((x) => p.sql[x.n] !== 'solved') || sqlQ.questions[0]
  const drill = DRILLS.find((d) => !p.drills[d.id])
  const due = Object.values(p.cards).filter((c) => c.due <= Date.now()).length
  const tasks = [
    { to: `/learn/${book.slug}/${ch.slug}`, k: 'Read', t: ch.title, d: `${book.title} · ${ch.minutes} min`, done: false, xp: 10 },
    { to: `/practice/sql/${q.n}`, k: 'Solve', t: q.title, d: `SQL lab · question ${q.n}`, xp: 20 },
    drill
      ? { to: `/drills/${drill.id}`, k: 'Fix', t: drill.title, d: 'Incident drill', xp: 50 }
      : { to: '/interview/flashcards', k: 'Review', t: due ? `${due} flashcards due` : 'Flashcards', d: 'Five minutes', xp: 5 },
  ]
  return (
    <section className="mission">
      <div className="container">
        <div className="mission-grid">
          <div className="mission-me card">
            <div className="lv-ico">{lv.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="small muted">Level {lv.i + 1}</div>
              <b className="lv-name">{lv.name}</b>
              <div className="progress" style={{ margin: '8px 0 6px' }}><i style={{ width: lv.pct + '%' }} /></div>
              <div className="small muted">{t.xp} XP{lv.next ? ` · ${lv.next.xp - t.xp} to ${lv.next.name}` : ''}</div>
            </div>
            <div className="streak"><b>🔥 {s}</b><span>day streak</span></div>
          </div>
          <div className="mission-tasks">
            <div className="spread" style={{ marginBottom: 10 }}>
              <div className="eyebrow" style={{ margin: 0 }}>Today's mission · Week {week.n}</div>
              <Link to={`/path/${week.n}`} className="small">{week.title} →</Link>
            </div>
            <div className="grid g3">
              {tasks.map((x) => (
                <Link key={x.to} to={x.to} className="card card-pad card-link task">
                  <div className="spread"><span className="tile-k">{x.k}</span><span className="chip chip-primary">+{x.xp} XP</span></div>
                  <b>{x.t}</b>
                  <div className="small muted">{x.d}</div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
