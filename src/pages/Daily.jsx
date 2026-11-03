import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import CodeEditor from '../components/CodeEditor.jsx'
import ResultTable from '../components/ResultTable.jsx'
import { runIsolated, ensureBig, compareResults } from '../lib/duck.js'
import { BIG, bigSetupSql } from '../data/bigdata.js'
import { DAILY, dayKey, dayNumber, keyForNumber, challengeFor } from '../data/daily.js'
import { useProgress, setIn } from '../lib/progress.js'

const LOCAL = 'z2h:daily'
function readLocal() { try { return JSON.parse(localStorage.getItem(LOCAL)) || {} } catch (e) { return {} } }
function writeLocal(v) { try { localStorage.setItem(LOCAL, JSON.stringify(v)) } catch (e) { /* ignore */ } }
const BIG_NAMES = BIG.map((b) => b.name)
const LEVEL_CLASS = { Easy: 'lvl-easy', Medium: 'lvl-med', Hard: 'lvl-hard' }

async function prepare() { await ensureBig(bigSetupSql(), { names: BIG_NAMES }) }
const expCache = new Map()
function expected(c) {
  if (!expCache.has(c.id)) {
    const p = prepare().then(() => runIsolated({ sql: c.ref, maxRows: 1000 }))
    expCache.set(c.id, p)
    p.then((r) => { if (r.error) expCache.delete(c.id) }, () => expCache.delete(c.id))
  }
  return expCache.get(c.id)
}

export function dailyStreak(checks, today = dayKey()) {
  const solved = new Set(Object.entries(checks).filter(([k, v]) => k.startsWith('daily:') && v && v.solved && (!v.on || v.on === k.slice(6))).map(([k]) => k.slice(6)))
  let n = dayNumber(today)
  if (!solved.has(keyForNumber(n))) n--
  let s = 0
  while (n >= 1 && solved.has(keyForNumber(n))) { s++; n-- }
  return s
}

function fmtTime(secs) { const m = Math.floor(secs / 60); const s = secs % 60; return m ? `${m}m ${s}s` : `${s}s` }

function useCountdown() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t) }, [])
  const end = new Date(now); end.setHours(24, 0, 0, 0)
  const s = Math.max(0, Math.floor((end - now) / 1000))
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function shareText(n, c, rec, streak) {
  const marks = '🟥'.repeat(Math.max(0, rec.tries - 1)) + (rec.solved ? '🟩' : '⬛')
  const url = `${location.origin}${location.pathname}#/daily`
  return `Daily SQL #${n} · ${c.level}\n${marks} ${rec.solved ? `solved in ${rec.tries} ${rec.tries === 1 ? 'try' : 'tries'} · ${fmtTime(rec.secs)}${rec.hint ? ' · used a hint' : ''}` : 'revealed the answer'}\n${streak > 1 ? `🔥 ${streak}-day streak\n` : ''}${url}`
}

function drawCard(n, c, rec, streak) {
  const W = 1200, H = 630
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H
  const g = cv.getContext('2d')
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#0b0c10'); bg.addColorStop(1, '#1a1408')
  g.fillStyle = bg; g.fillRect(0, 0, W, H)
  const glow = g.createRadialGradient(W * 0.85, H * 0.1, 10, W * 0.85, H * 0.1, 520); glow.addColorStop(0, 'rgba(242,177,75,.35)'); glow.addColorStop(1, 'rgba(242,177,75,0)')
  g.fillStyle = glow; g.fillRect(0, 0, W, H)
  g.fillStyle = '#f2b14b'; g.font = '500 26px "JetBrains Mono", monospace'; g.fillText(`DAILY SQL #${n} · ${c.level.toUpperCase()}`, 72, 104)
  g.fillStyle = '#f1efe9'; g.font = '400 76px "Instrument Serif", Georgia, serif'; g.fillText(c.title, 72, 200)
  const sq = 54, gap = 14; let x = 72
  const cells = Array.from({ length: Math.max(0, rec.tries - 1) }, () => '#e5534b').concat(rec.solved ? '#3fb27f' : '#3a3d45')
  for (const col of cells.slice(-12)) { g.fillStyle = col; g.beginPath(); g.roundRect(x, 260, sq, sq, 12); g.fill(); x += sq + gap }
  g.fillStyle = '#f1efe9'; g.font = '600 44px "Inter Tight", system-ui, sans-serif'
  g.fillText(rec.solved ? `Solved in ${rec.tries} ${rec.tries === 1 ? 'try' : 'tries'}` : 'Answer revealed', 72, 400)
  g.fillStyle = '#b9b5ab'; g.font = '400 30px "Inter Tight", system-ui, sans-serif'
  g.fillText([rec.solved ? fmtTime(rec.secs) : null, rec.hint ? 'used a hint' : 'no hints', streak > 1 ? `${streak}-day streak` : null].filter(Boolean).join('  ·  '), 72, 452)
  g.fillStyle = '#f2b14b'; g.font = '500 24px "JetBrains Mono", monospace'; g.fillText('Zero to Hero · Data Engineering', 72, 560)
  g.fillStyle = '#7d7a72'; g.fillText('2.6M rows · real SQL · free', W - 470, 560)
  return cv
}

export default function Daily() {
  const { n: nParam } = useParams()
  const navigate = useNavigate()
  const p = useProgress()
  const todayN = dayNumber()
  const n = Math.min(todayN, Math.max(1, Number(nParam) || todayN))
  const key = keyForNumber(n)
  const c = challengeFor(n)
  const isToday = n === todayN
  const saved = p.checks['daily:' + key]
  const [local, setLocal] = useState(readLocal)
  const rec = { tries: 0, hint: false, ...(local[key] || {}), ...(saved || {}) }
  const draftKey = `z2h:code:daily:${key}`
  const [code, setCode] = useState('')
  const [res, setRes] = useState(null)
  const [verdict, setVerdict] = useState(null)
  const [want, setWant] = useState(null)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState(null)
  const [copied, setCopied] = useState(false)
  const [showRef, setShowRef] = useState(false)
  const warmed = useRef(false)
  const countdown = useCountdown()
  const streak = dailyStreak(p.checks)
  const done = !!(saved && (saved.solved || saved.revealed))

  useEffect(() => {
    let v = ''
    try { v = localStorage.getItem(draftKey) || '' } catch (e) { /* ignore */ }
    setCode(v || `-- Daily SQL #${n}: ${c.title}\n-- Return: ${c.cols}\n\nSELECT\n`)
    setRes(null); setVerdict(null); setWant(null); setShowRef(false)
  }, [key])
  useEffect(() => { if (code) try { localStorage.setItem(draftKey, code) } catch (e) { /* ignore */ } }, [code, draftKey])

  function patchLocal(patch) {
    setLocal((cur) => { const next = { ...cur, [key]: { ...(cur[key] || {}), ...patch } }; writeLocal(next); return next })
  }
  useEffect(() => { if (!rec.start && !done) patchLocal({ start: Date.now() }) }, [key])

  async function run(submit) {
    setBusy(true)
    if (!warmed.current) setStatus('Loading 2.6 million rows of practice data in your browser (first time only, a few seconds).')
    try {
      await prepare(); warmed.current = true; setStatus(null)
      const r = await runIsolated({ sql: code, maxRows: 1000 })
      setRes(r)
      if (submit && !done) {
        const tries = rec.tries + 1
        if (r.error) { setVerdict({ ok: false, why: 'Your SQL has an error. Fix it and submit again.' }); patchLocal({ tries }) }
        else {
          const w = await expected(c)
          const v = r.more ? { ok: false, why: 'Your query returns more than 1,000 rows. The answer is much smaller.' } : compareResults(r.result, w.result)
          setVerdict(v)
          if (v.ok) {
            const secs = Math.max(1, Math.round((Date.now() - (rec.start || Date.now())) / 1000))
            setIn('checks', 'daily:' + key, { solved: true, tries, hint: rec.hint, secs, on: dayKey() })
          } else { patchLocal({ tries }); setWant(w.result) }
        }
      }
    } catch (e) { setRes({ error: String(e?.message || e), ms: 0 }) }
    setStatus(null); setBusy(false)
  }
  function reveal() { setShowRef(true); if (!done) setIn('checks', 'daily:' + key, { revealed: true, tries: rec.tries, hint: rec.hint, secs: 0 }) }
  function hint() { patchLocal({ hint: true }) }

  const final = saved ? { ...rec, ...saved } : rec
  const text = done ? shareText(n, c, final, streak) : ''
  async function copy() { try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch (e) { /* ignore */ } }
  function download() {
    const cv = drawCard(n, c, final, streak)
    const a = document.createElement('a'); a.href = cv.toDataURL('image/png'); a.download = `daily-sql-${n}.png`; a.click()
  }
  const past = useMemo(() => Array.from({ length: todayN }, (_, i) => todayN - i), [todayN])

  return (
    <div className="page daily">
      <div className="container wide">
        <div className="daily-head">
          <div>
            <div className="eyebrow">Daily SQL challenge · #{n}{isToday ? ' · today' : ` · ${key}`}</div>
            <h1>{c.title}</h1>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <span className={'chip ' + LEVEL_CLASS[c.level]}>{c.level}</span>
              <span className="chip">🔥 {streak}-day daily streak</span>
              <span className="chip">Next challenge in <b className="mono">&nbsp;{countdown}</b></span>
            </div>
          </div>
          {!isToday && <Link to="/daily" className="btn btn-ghost btn-sm">← Today's challenge</Link>}
        </div>

        <div className="daily-grid">
          <div className="daily-main">
            <div className="card card-pad daily-q">
              <p className="daily-prompt">{c.prompt}</p>
              <div className="small muted">Return: <code>{c.cols}</code></div>
              <div className="small muted daily-tables">Tables: {BIG_NAMES.map((t) => <code key={t}>{t}</code>)}<Link to="/playground">see columns</Link></div>
              {rec.hint || done ? <div className="daily-hint">💡 {c.hint}</div> : !done && <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }} onClick={hint}>Show a hint</button>}
            </div>

            <div className="play-editor card" style={{ marginTop: 14 }}>
              <CodeEditor value={code} onChange={setCode} onRun={() => run(false)} minHeight={260} />
              <div className="play-bar">
                <button className="btn btn-ghost" onClick={() => run(false)} disabled={busy}>▶ Run</button>
                {!done && <button className="btn btn-primary" onClick={() => run(true)} disabled={busy}>{busy ? 'Checking…' : 'Submit answer'}</button>}
                <span className="small muted">Tries: {final.tries}{rec.hint ? ' · hint used' : ''}</span>
                {!done && final.tries >= 3 && <button className="btn btn-ghost btn-sm" onClick={reveal}>Give up and show the answer</button>}
              </div>
            </div>
            {status && <div className="loading" style={{ marginTop: 12 }}><span className="spinner" /> {status}</div>}
            {verdict && !verdict.ok && <div className="verdict bad" style={{ marginTop: 12 }}>❌ Not yet. {verdict.why}</div>}
            {res && (
              <div className="result play-result">
                <div className="result-head"><span>{res.error ? 'Error' : res.result ? (res.more ? 'First 1,000 rows (there are more)' : `${res.result.rows.length} rows`) : 'Done'}</span><span>{Math.round(res.ms)} ms</span></div>
                {res.error ? <div className="err">{res.error}</div> : <ResultTable result={res.result} max={1000} />}
              </div>
            )}
            {want && !done && final.tries >= 2 && (
              <details className="card card-pad" style={{ marginTop: 12 }}><summary className="small">Peek at the expected result ({want.rows.length} rows)</summary><ResultTable result={want} max={40} /></details>
            )}
            {(showRef || (saved && saved.revealed)) && <pre className="mini-code" style={{ marginTop: 14 }}>{c.ref}</pre>}
          </div>

          <aside className="daily-side">
            {done ? (
              <div className="card card-pad daily-done">
                <div className="daily-big">{saved.solved ? '🎉' : '📘'}</div>
                <h3 style={{ margin: '6px 0 4px' }}>{saved.solved ? `Solved in ${saved.tries} ${saved.tries === 1 ? 'try' : 'tries'}` : 'Answer revealed'}</h3>
                <p className="small muted" style={{ marginTop: 0 }}>{saved.solved ? `${fmtTime(saved.secs)}${saved.hint ? ' · used a hint' : ' · no hints'} · +30 XP` : 'No XP this time. Read the answer, then try it yourself tomorrow.'}</p>
                <pre className="share-text">{text}</pre>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" onClick={copy}>{copied ? 'Copied ✓' : 'Copy result'}</button>
                  <button className="btn btn-ghost btn-sm" onClick={download}>Download card</button>
                  <a className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer" href={`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`}>Post on LinkedIn</a>
                </div>
                {saved.solved && !showRef && <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setShowRef(true)}>Compare with our solution</button>}
              </div>
            ) : (
              <div className="card card-pad">
                <b>How it works</b>
                <ol className="small muted daily-rules">
                  <li>One new challenge every day, the same for everyone.</li>
                  <li>Run as often as you like. Only <b>Submit</b> counts as a try.</li>
                  <li>Row order and column names don't matter. Numbers are compared to 2 decimals.</li>
                  <li>Solve it to earn 30 XP and keep your daily streak alive.</li>
                </ol>
              </div>
            )}
            <div className="card card-pad" style={{ marginTop: 14 }}>
              <b>Past challenges</b>
              <div className="daily-past">
                {past.map((k) => {
                  const r = p.checks['daily:' + keyForNumber(k)]
                  return <button key={k} className={'past' + (k === n ? ' on' : '') + (r?.solved ? ' ok' : r?.revealed ? ' rev' : '')} onClick={() => navigate(k === todayN ? '/daily' : `/daily/${k}`)} title={challengeFor(k).title}>#{k}</button>
                })}
              </div>
              <p className="small muted" style={{ marginBottom: 0 }}>{DAILY.length} challenges in rotation. A new one unlocks every midnight.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  )
}
