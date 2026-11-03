import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTheme } from '../lib/theme.js'
import { BRAND } from '../data/extras.js'
import Search from './Search.jsx'
import Celebrate from './Celebrate.jsx'
import { useProgress } from '../lib/progress.js'
import { tally, levelOf } from '../lib/xp.js'

const NAV = [
  ['/path', 'Path'],
  ['/learn', 'Learn'],
  ['/visual', 'Visual SQL'],
  ['/practice/sql', 'SQL Lab'],
  ['/playground', 'Playground'],
  ['/practice/python', 'Python Lab'],
  ['/drills', 'Incidents'],
  ['/interview', 'Interview'],
]

export default function Layout() {
  const { isDark, toggle } = useTheme()
  const prog = useProgress()
  const xp = tally(prog).xp
  const lv = levelOf(xp)
  const [search, setSearch] = useState(false)
  const [menu, setMenu] = useState(false)
  const loc = useLocation()
  useEffect(() => { setMenu(false); if (!loc.hash) window.scrollTo(0, 0) }, [loc.pathname])
  useEffect(() => {
    if (loc.hash) {
      const t = setTimeout(() => document.getElementById(decodeURIComponent(loc.hash.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
      return () => clearTimeout(t)
    }
  }, [loc.hash, loc.pathname])
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(true) }
      if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && !document.activeElement?.closest('.cm-editor')) { e.preventDefault(); setSearch(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="shell">
      <header className="header">
        <div className="container">
          <Link to="/" className="brand" aria-label="Home">
            <span className="brand-mark"><i /><i /><i /></span>
            <span>{BRAND.name} <small>{BRAND.tagline}</small></span>
          </Link>
          <nav className="nav" aria-label="Main">
            {NAV.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}
          </nav>
          <div className="header-right">
            <button className="icon-btn search-btn" onClick={() => setSearch(true)} aria-label="Search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <span>Search</span><kbd>Ctrl K</kbd>
            </button>
            <button className="icon-btn" onClick={toggle} aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'} title="Theme">
              {isDark
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
            </button>
            <Link to="/progress" className="xp-pill" title={`${lv.name} · ${xp} XP`}><span>{lv.icon}</span><b>{xp}</b><small>XP</small></Link>
            <Link to="/pro" className="btn btn-primary btn-sm hide-sm">Go Pro</Link>
            <button className="icon-btn menu-btn" onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          </div>
        </div>
      </header>
      <nav className={'mobile-nav' + (menu ? ' open' : '')} aria-label="Mobile">
        {NAV.map(([to, label]) => <NavLink key={to} to={to}>{label}</NavLink>)}
        <NavLink to="/progress">Progress</NavLink>
        <NavLink to="/notes">Notes</NavLink>
        <NavLink to="/projects">Projects</NavLink>
        <NavLink to="/pro">Go Pro</NavLink>
      </nav>
      <main><Outlet /></main>
      <footer className="footer">
        <div className="container footer-grid">
          <div>
            <Link to="/" className="brand"><span className="brand-mark"><i /><i /><i /></span><span>{BRAND.name}</span></Link>
            <p style={{ marginTop: 12, maxWidth: 360 }}>A free, hands-on path into data engineering. Written by {BRAND.author}, {BRAND.authorRole}. Learning stays free, forever.</p>
          </div>
          <div><h4>Learn</h4><Link to="/path">12-week path</Link><Link to="/learn">Handbooks</Link><Link to="/visual">Visual SQL</Link><Link to="/notes">Notes</Link><Link to="/projects">Projects</Link><Link to="/resources">Resources</Link></div>
          <div><h4>Practice</h4><Link to="/practice/sql">SQL lab</Link><Link to="/playground">SQL playground</Link><Link to="/practice/python">Python lab</Link><Link to="/drills">Incident drills</Link><Link to="/interview">Interview prep</Link><Link to="/interview/quiz">Quiz</Link></div>
          <div><h4>About</h4><Link to="/about">About and mantras</Link><Link to="/pro">Pro</Link><a href={BRAND.portfolio} target="_blank" rel="noreferrer">Author's portfolio</a><a href={`mailto:${BRAND.email}`}>Contact</a></div>
        </div>
      </footer>
      {search && <Search onClose={() => setSearch(false)} />}
      <Celebrate />
    </div>
  )
}
