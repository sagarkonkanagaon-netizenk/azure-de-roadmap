import { Link } from 'react-router-dom'
import sqlQ from '../content/sql-questions.json'
import pyQ from '../content/py-questions.json'
import scen from '../content/scenarios.json'
import Markdown from '../components/Markdown.jsx'
import { PLAYBOOK } from '../data/extras.js'
import { QUIZ } from '../data/quiz.js'
import { useProgress, setIn, toggleIn } from '../lib/progress.js'

const SPARK = pyQ.questions.filter((q) => q.section === 'PySpark')
const PY = pyQ.questions.filter((q) => q.section === 'Python')
const SC_COUNT = scen.sections.reduce((a, s) => a + s.questions.length, 0)

export default function Interview() {
  const p = useProgress()
  const count = (area, list, val = 'solved') => list.filter((q) => p[area][q.n] === val).length
  const cards = [
    { to: '/interview/playbook', ico: '🎤', title: 'Tell me about yourself', desc: 'The six-beat intro, your sprint process, six day-to-day stories, and how to adjust them to each company.', stat: 'Playbook' },
    { to: '/interview/scenarios', ico: '🔥', title: 'Scenario questions', desc: 'Incidents, performance, conflict, ownership, design. Model answers plus the push-backs interviewers use to test you.', stat: `${Object.keys(p.scenarios).length}/${SC_COUNT} practised` },
    { to: '/practice/sql', ico: '🗄️', title: 'SQL questions', desc: 'From second-highest salary to sessionization and SCD Type 2. Runnable, auto-checked, with the traps explained.', stat: `${count('sql', sqlQ.questions)}/${sqlQ.questions.length} solved` },
    { to: '/practice/python', ico: '🐍', title: 'Python coding', desc: 'Warm-up problems interviewers use for data engineers: hashing, two pointers, generators, big files.', stat: `${count('py', PY)}/${PY.length} solved` },
    { to: '/interview/pyspark', ico: '⚡', title: 'PySpark coding', desc: 'Dedup, SCD, skew, JSON flattening, corrupt records, streaming. Think first, then compare with the answer.', stat: `${count('spark', SPARK, 'known')}/${SPARK.length} known` },
    { to: '/interview/quiz', ico: '🎯', title: 'Quiz', desc: 'Ten-question rounds on Azure, AWS or GCP. Every wrong option is a real mistake, so guessing does not work.', stat: p.checks['quiz:azure'] != null ? `Best ${p.checks['quiz:azure']}%` : `${QUIZ.length} questions` },
    { to: '/interview/flashcards', ico: '🃏', title: 'Flashcards', desc: 'Spaced repetition across Spark, SQL, ADF, Databricks, Delta Lake and Python. Five minutes a day.', stat: 'Daily review' },
  ]
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div className="eyebrow">Interview prep</div>
          <h1>Walk in ready</h1>
          <p>Everything you need for data engineering interviews in one place. Solve, say it out loud, and let the flashcards bring back what you forget.</p>
        </div>
        <div className="grid g3">
          {cards.map((c) => (
            <Link key={c.to} to={c.to} className="card feature card-link">
              <div className="ico">{c.ico}</div>
              <h3>{c.title}</h3>
              <p>{c.desc}</p>
              <div className="chip chip-primary" style={{ marginTop: 14 }}>{c.stat}</div>
            </Link>
          ))}
        </div>
        <div className="card card-pad" style={{ marginTop: 28 }}>
          <h3>In the SQL round</h3>
          <ol style={{ margin: 0, paddingLeft: '1.2em' }}>{sqlQ.tips.map((t) => <li key={t}>{t.replace(/^\d\.\s*/, '')}</li>)}</ol>
        </div>
      </div>
    </div>
  )
}

export function Scenarios() {
  const p = useProgress()
  return (
    <div className="page">
      <div className="container narrow">
        <Link to="/interview" className="small">← Interview prep</Link>
        <div className="page-head" style={{ marginTop: 10 }}>
          <div className="eyebrow">Scenario questions</div>
          <h1>{SC_COUNT} questions, with push-backs</h1>
          <p>Answer out loud first. Then open the model answer and the follow-ups. Swap the example numbers for your own: follow-ups will test them.</p>
        </div>
        <div className="card card-pad" style={{ marginBottom: 24 }}>
          <b>How to answer, every time</b>
          <ol style={{ margin: '8px 0 0', paddingLeft: '1.2em' }}>{scen.steps.map((s) => <li key={s}>{s.replace(/^\d\.\s*/, '')}</li>)}</ol>
        </div>
        {scen.sections.map((s) => (
          <div key={s.title} style={{ marginBottom: 30 }}>
            <h2>{s.title}</h2>
            <div className="stack">
              {s.questions.map((q) => (
                <div key={q.n} id={`q${q.n}`} className="card card-pad">
                  <div className="spread"><span className="chip">Q{q.n}</span>
                    <label className="row small"><input type="checkbox" checked={!!p.scenarios[q.n]} onChange={() => toggleIn('scenarios', q.n)} /> Practised out loud</label>
                  </div>
                  <h3 style={{ margin: '10px 0' }}>{q.title}</h3>
                  <details className="reveal">
                    <summary>Model answer</summary>
                    <div className="inner">
                      <p>{q.answer}</p>
                      {q.summary && <div className="chip chip-primary" style={{ whiteSpace: 'normal' }}>▶ {q.summary}</div>}
                    </div>
                  </details>
                  {q.pushbacks.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <div className="small muted" style={{ margin: '6px 0' }}>If they push back:</div>
                      <div className="stack">
                        {q.pushbacks.map((pb, i) => (
                          <details key={i} className="reveal">
                            <summary>“{pb.q}”</summary>
                            <div className="inner">{pb.a}</div>
                          </details>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="grid g2">
          <div className="card card-pad"><b>Do</b><ul className="ticks">{scen.do.map((x) => <li key={x}>{x}</li>)}</ul></div>
          <div className="card card-pad"><b>Don't</b><ul className="ticks">{scen.dont.map((x) => <li key={x} className="no">{x}</li>)}</ul></div>
        </div>
      </div>
    </div>
  )
}

export function PySparkQs() {
  const p = useProgress()
  const known = SPARK.filter((q) => p.spark[q.n] === 'known').length
  return (
    <div className="page">
      <div className="container narrow">
        <Link to="/interview" className="small">← Interview prep</Link>
        <div className="page-head" style={{ marginTop: 10 }}>
          <div className="eyebrow">PySpark coding</div>
          <h1>{SPARK.length} PySpark questions</h1>
          <p>Spark doesn't run in a browser tab, so these are think-first cards: write your answer on paper or in Databricks Free Edition, then compare. {known} marked as known.</p>
        </div>
        <div className="stack">
          {SPARK.map((q) => (
            <div key={q.n} id={`q${q.n}`} className="card card-pad">
              <div className="spread"><span className="chip">#{q.n}</span>{p.spark[q.n] === 'known' ? <span className="chip chip-ok">Known</span> : p.spark[q.n] === 'review' ? <span className="chip chip-warn">Review</span> : null}</div>
              <h3 style={{ margin: '10px 0 6px' }}>{q.title}</h3>
              {q.given && <div className="given">{q.given}</div>}
              <details className="reveal" style={{ marginTop: 10 }}>
                <summary>Answer</summary>
                <div className="inner">
                  <Markdown md={'```python\n' + q.answer + '\n```'} />
                  {q.note && <div className="note"><b>Why: </b>{q.note}</div>}
                  <div className="row" style={{ marginTop: 12 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => setIn('spark', q.n, 'known')}>I knew it</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setIn('spark', q.n, 'review')}>Review again</button>
                  </div>
                </div>
              </details>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Playbook() {
  return (
    <div className="page">
      <div className="container narrow">
        <Link to="/interview" className="small">← Interview prep</Link>
        <div className="page-head" style={{ marginTop: 10 }}>
          <div className="eyebrow">Playbook</div>
          <h1>Tell me about yourself, and your day to day</h1>
          <p>The first five minutes decide how the next fifty go. Use this structure with your own facts.</p>
        </div>
        <Markdown md={PLAYBOOK} />
      </div>
    </div>
  )
}
