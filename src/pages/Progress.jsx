import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import booksIndex from '../content/books-index.json'
import sqlQ from '../content/sql-questions.json'
import pyQ from '../content/py-questions.json'
import { WEEKS, PHASES } from '../data/path.js'
import { DRILLS } from '../data/drills.js'
import { useProgress, streak, exportProgress, importProgress, resetProgress } from '../lib/progress.js'
import { weekStats } from './Path.jsx'
import { tally, levelOf, badgesOf, LEVELS } from '../lib/xp.js'

export default function ProgressPage() {
  const p = useProgress()
  const file = useRef(null)
  const [msg, setMsg] = useState('')
  const totalCh = booksIndex.reduce((a, b) => a + b.chapters.length, 0)
  const read = Object.keys(p.chapters).length
  const sql = Object.values(p.sql).filter((v) => v === 'solved').length
  const py = Object.values(p.py).filter((v) => v === 'solved').length
  const spark = Object.values(p.spark).filter((v) => v === 'known').length
  const drills = Object.keys(p.drills).length
  const cards = Object.values(p.cards).filter((c) => c.box >= 4).length
  const nextWeek = WEEKS.find((w) => weekStats(w, p).pct < 100) || WEEKS[WEEKS.length - 1]
  const s = streak(p.days)
  const last28 = Array.from({ length: 28 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() - (27 - i)); return d.toISOString().slice(0, 10) })

  const loc = useLocation()
  useEffect(() => { if (loc.hash === '#backup') setTimeout(() => document.getElementById('backup')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }, [loc.hash])
  const download = () => {
    const blob = new Blob([exportProgress()], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob); a.download = 'data-dhaba-progress.json'; a.click()
    try { localStorage.setItem('dd:backup', String(Date.now())) } catch (err) { /* ignore */ }
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const upload = async (e) => {
    const f = e.target.files[0]; if (!f) return
    try { importProgress(await f.text()); setMsg('Progress imported.') } catch (err) { setMsg('That file is not a valid progress export.') }
  }
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div className="eyebrow">Your progress</div>
          <h1>{read + sql + py + drills === 0 ? 'Your journey starts here' : 'Keep the streak going'}</h1>
          <p>Saved on this device. Export it to move to another browser.</p>
        </div>
        <LevelCard p={p} />
        <div className="grid g3" style={{ marginBottom: 18 }}>
          <div className="card card-pad kpi"><b>🔥 {s} day{s === 1 ? '' : 's'}</b><span>current streak</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(14, 1fr)', gap: 4, marginTop: 14 }}>
              {last28.map((d) => <i key={d} title={d} style={{ height: 14, borderRadius: 4, background: p.days.includes(d) ? 'var(--primary)' : 'var(--bg-2)', display: 'block' }} />)}
            </div>
          </div>
          <div className="card card-pad">
            <div className="small muted">Up next</div>
            <h3 style={{ margin: '6px 0' }}>Week {nextWeek.n}: {nextWeek.title}</h3>
            <div className="row" style={{ margin: '10px 0' }}><div className="progress" style={{ flex: 1 }}><i style={{ width: weekStats(nextWeek, p).pct + '%' }} /></div><span className="small muted">{weekStats(nextWeek, p).pct}%</span></div>
            <Link className="btn btn-primary btn-sm" to={`/path/${nextWeek.n}`}>Continue</Link>
          </div>
          <div className="card card-pad">
            <div className="small muted">Today's 15 minutes</div>
            <ul className="ticks" style={{ margin: '8px 0 0' }}>
              <li><Link to="/interview/flashcards">Review due flashcards</Link></li>
              <li><Link to={`/practice/sql/${(sqlQ.questions.find((q) => p.sql[q.n] !== 'solved') || sqlQ.questions[0]).n}`}>Solve one SQL question</Link></li>
              <li><Link to="/path">Read one chapter</Link></li>
            </ul>
          </div>
        </div>
        <div className="grid g3" style={{ marginBottom: 28 }}>
          {[
            ['📘', read, totalCh, 'chapters read', '/learn'],
            ['🗄️', sql, sqlQ.questions.length, 'SQL questions solved', '/practice/sql'],
            ['🐍', py, pyQ.questions.filter((q) => q.section === 'Python').length, 'Python questions solved', '/practice/python'],
            ['⚡', spark, pyQ.questions.filter((q) => q.section === 'PySpark').length, 'PySpark answers known', '/interview/pyspark'],
            ['🚨', drills, DRILLS.length, 'incidents resolved', '/drills'],
            ['🃏', cards, null, 'flashcards mastered', '/interview/flashcards'],
          ].map(([ico, n, tot, label, to]) => (
            <Link key={label} to={to} className="card card-pad card-link kpi">
              <b>{ico} {n}{tot ? <span className="muted" style={{ fontSize: '1rem' }}> / {tot}</span> : null}</b><span>{label}</span>
              {tot ? <div className="progress" style={{ marginTop: 10 }}><i style={{ width: (100 * n / tot) + '%' }} /></div> : null}
            </Link>
          ))}
        </div>
        <h2>Skill map</h2>
        <div className="card card-pad" style={{ marginBottom: 28 }}>
          {PHASES.map((ph) => {
            const ws = WEEKS.filter((w) => w.phase === ph.n)
            const pct = Math.round(ws.reduce((a, w) => a + weekStats(w, p).pct, 0) / ws.length)
            return (
              <div key={ph.n} className="row" style={{ padding: '8px 0' }}>
                <span style={{ width: 260, maxWidth: '50%' }}><span className="medal" style={{ background: ph.color, marginRight: 8 }} />{ph.title}</span>
                <div className="progress" style={{ flex: 1, minWidth: 80 }}><i style={{ width: pct + '%' }} /></div>
                <span className="small muted" style={{ width: 40, textAlign: 'right' }}>{pct}%</span>
              </div>
            )
          })}
        </div>
        <div className="row backup-row" id="backup">
          <button className="btn btn-primary btn-sm" onClick={download}>Back up progress</button>
          <button className="btn btn-ghost btn-sm" onClick={() => file.current.click()}>Import progress</button>
          <input ref={file} type="file" accept="application/json" style={{ display: 'none' }} onChange={upload} />
          <button className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm('Reset all progress on this device?')) resetProgress() }}>Reset</button>
          {msg && <span className="small muted">{msg}</span>}
        </div>
      </div>
    </div>
  )
}

function LevelCard({ p }) {
  const t = tally(p)
  const lv = levelOf(t.xp)
  const badges = badgesOf(p)
  return (
    <div className="card card-pad levelcard" style={{ marginBottom: 18 }}>
      <div className="levelcard-top">
        <div className="lv-ico big">{lv.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="small muted">Level {lv.i + 1} of {LEVELS.length}</div>
          <h2 style={{ margin: '2px 0 8px' }}>{lv.name}</h2>
          <div className="progress"><i style={{ width: lv.pct + '%' }} /></div>
          <div className="small muted" style={{ marginTop: 6 }}>{t.xp} XP{lv.next ? ` · ${lv.next.xp - t.xp} XP to ${lv.next.icon} ${lv.next.name}` : ' · top level reached'}</div>
        </div>
      </div>
      <div className="ladder">{LEVELS.map((l, i) => <span key={l.name} className={i <= lv.i ? 'on' : ''} title={`${l.name} · ${l.xp} XP`}>{l.icon}</span>)}</div>
      <h3 style={{ marginTop: 22 }}>Badges · {badges.filter((b) => b.earned).length}/{badges.length}</h3>
      <div className="badges">
        {badges.map((b) => (
          <div key={b.id} className={'badge' + (b.earned ? ' on' : '')} title={b.desc}>
            <span className="b-ico">{b.icon}</span><b>{b.name}</b><small>{b.desc}</small>
          </div>
        ))}
      </div>
    </div>
  )
}
