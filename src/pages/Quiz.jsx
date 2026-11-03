import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { QUIZ, TRACKS } from '../data/quiz.js'
import { useProgress, update } from '../lib/progress.js'

const ROUND = 10
const LETTERS = ['A', 'B', 'C', 'D']

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// Options are stored with the right answer first; shuffle them per question so position never tells.
function makeRound(pool) {
  return shuffle(pool).slice(0, ROUND).map((it) => {
    const opts = shuffle(it.a.map((text, i) => ({ text, ok: i === 0 })))
    return { ...it, opts }
  })
}

export default function Quiz() {
  const p = useProgress()
  const [track, setTrack] = useState('azure')
  const [topic, setTopic] = useState('All')
  const topics = useMemo(() => ['All', ...new Set(QUIZ.filter((x) => x.track === track).map((x) => x.topic))], [track])
  const pool = QUIZ.filter((x) => x.track === track && (topic === 'All' || x.topic === topic))
  const [round, setRound] = useState(null)
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState(0)
  const best = p.checks['quiz:' + track]

  function start() { setRound(makeRound(pool)); setI(0); setPicked(null); setScore(0) }
  function pick(k) {
    if (picked !== null) return
    setPicked(k)
    if (round[i].opts[k].ok) setScore((s) => s + 1)
  }
  function next() {
    if (i + 1 < round.length) { setI(i + 1); setPicked(null); return }
    const pct = Math.round((100 * score) / round.length)
    update((s) => { if (!s.checks['quiz:' + track] || s.checks['quiz:' + track] < pct) s.checks = { ...s.checks, ['quiz:' + track]: pct } })
    setI(round.length)
  }

  const cur = round && round[i]
  return (
    <div className="page">
      <div className="container narrow">
        <Link to="/interview" className="small">← Interview prep</Link>
        <div className="page-head" style={{ marginTop: 10 }}>
          <div className="eyebrow">Quiz</div>
          <h1>Ten questions. No easy outs.</h1>
          <p>Every wrong option is a mistake real candidates make, so you can't guess by picking the longest answer. {QUIZ.length} questions across Azure, AWS and Google Cloud.</p>
        </div>

        {!round && (
          <>
            <div className="tabs" style={{ marginBottom: 12 }}>
              {TRACKS.map((t) => <button key={t.id} className={t.id === track ? 'on' : ''} onClick={() => { setTrack(t.id); setTopic('All') }}>{t.name}</button>)}
            </div>
            <div className="row" style={{ flexWrap: 'wrap', gap: 6, marginBottom: 18 }}>
              {topics.map((t) => <button key={t} className={'chip' + (t === topic ? ' chip-primary' : '')} style={{ cursor: 'pointer' }} onClick={() => setTopic(t)}>{t}</button>)}
            </div>
            <div className="card card-pad">
              <b>{TRACKS.find((t) => t.id === track).name}{topic !== 'All' ? ` · ${topic}` : ''}</b>
              <p className="muted small" style={{ margin: '6px 0 14px' }}>{pool.length} questions in this set. Each round picks {Math.min(ROUND, pool.length)} at random.{best != null ? ` Your best on this track: ${best}%.` : ''}</p>
              <button className="btn btn-primary" onClick={start} disabled={!pool.length}>Start a round</button>
            </div>
          </>
        )}

        {cur && (
          <div className="card card-pad">
            <div className="spread small muted" style={{ marginBottom: 10 }}>
              <span>Question {i + 1} of {round.length} · {cur.topic} · {cur.level}</span><span>Score {score}</span>
            </div>
            <div className="progress" style={{ marginBottom: 16 }}><i style={{ width: (100 * i) / round.length + '%' }} /></div>
            <h3 style={{ marginTop: 0 }}>{cur.q}</h3>
            <div className="stack" style={{ gap: 8 }}>
              {cur.opts.map((o, k) => {
                const state = picked === null ? '' : o.ok ? ' ok' : k === picked ? ' bad' : ' dim'
                return (
                  <button key={k} className={'opt' + state} onClick={() => pick(k)} disabled={picked !== null}>
                    <span className="opt-l">{LETTERS[k]}</span><span>{o.text}</span>
                  </button>
                )
              })}
            </div>
            {picked !== null && (
              <>
                <div className={'verdict ' + (cur.opts[picked].ok ? 'ok' : 'bad')} style={{ marginTop: 14 }}>
                  <span>{cur.opts[picked].ok ? '✅' : '❌'}</span>
                  <div>{cur.opts[picked].ok ? 'Correct.' : 'Not quite.'}<small>{cur.exp}</small></div>
                </div>
                <div className="row" style={{ marginTop: 14, justifyContent: 'flex-end' }}>
                  <button className="btn btn-primary" onClick={next}>{i + 1 < round.length ? 'Next question →' : 'See my score'}</button>
                </div>
              </>
            )}
          </div>
        )}

        {round && i >= round.length && (
          <div className="card card-pad center">
            <div style={{ fontSize: '2.4rem' }}>{score >= 8 ? '🏆' : score >= 5 ? '💪' : '📚'}</div>
            <h2>{score} / {round.length}</h2>
            <p className="muted">{score >= 8 ? 'Interview-ready on this set. Try another track.' : score >= 5 ? 'Solid. Read the explanations you missed and go again.' : 'Good start. The handbooks and flashcards cover every one of these.'}</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={start}>Another round</button>
              <button className="btn btn-ghost" onClick={() => setRound(null)}>Change track</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
