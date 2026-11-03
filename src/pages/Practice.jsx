import { Link } from 'react-router-dom'
import sqlQ from '../content/sql-questions.json'
import pyQ from '../content/py-questions.json'
import { DRILLS } from '../data/drills.js'
import { useProgress } from '../lib/progress.js'

const PY = pyQ.questions.filter((q) => q.section === 'Python')

// Practice overview: four ways to practise, each explained in one plain sentence.
export default function Practice() {
  const p = useProgress()
  const solved = (area) => Object.values(p[area] || {}).filter((v) => v === 'solved').length
  const cards = [
    { to: '/practice/sql', title: 'SQL Lab', who: 'Start here', desc: 'Short SQL problems from easy to hard. Write a query, press Run, and see straight away if it is right.', stat: `${solved('sql')}/${sqlQ.questions.length} solved` },
    { to: '/playground', title: 'SQL Playground', who: 'Explore freely', desc: 'An empty editor and five big tables (2.6 million rows of shop, web and taxi data). Run any query you like.', stat: '2.6M rows' },
    { to: '/practice/python', title: 'Python Lab', who: 'After some SQL', desc: 'Python problems that data engineers get in interviews, with tests that check your code.', stat: `${solved('py')}/${PY.length} solved` },
    { to: '/drills', title: 'Incident drills', who: 'For real-world practice', desc: 'A pipeline broke and the numbers are wrong. Find the cause with SQL and fix it, like on a real on-call shift.', stat: `${Object.keys(p.drills || {}).length}/${DRILLS.length} done` },
  ]
  return (
    <div className="page">
      <div className="container">
        <div className="page-head">
          <div className="eyebrow">Practice</div>
          <h1>Practise in your browser</h1>
          <p>Everything runs on this page, so there is nothing to install. New to SQL? Start with the SQL Lab, then try the Playground.</p>
        </div>
        <div className="grid g2">
          {cards.map((c) => (
            <Link key={c.to} to={c.to} className="card hub-card card-link">
              <span className="basic-k">{c.who}</span>
              <h2>{c.title}</h2>
              <p>{c.desc}</p>
              <span className="hub-foot"><span className="chip">{c.stat}</span><span className="hub-go">Open →</span></span>
            </Link>
          ))}
        </div>
        <Link to="/practice/tables" className="card card-pad card-link hub-daily">
          <b>Not sure what is in the data?</b> <span className="muted">See every practice table, its columns and how they connect.</span>
        </Link>
        <Link to="/daily" className="card card-pad card-link hub-daily">
          <b>Short on time?</b> <span className="muted">Do today's daily SQL challenge. It takes about five minutes.</span>
        </Link>
      </div>
    </div>
  )
}
