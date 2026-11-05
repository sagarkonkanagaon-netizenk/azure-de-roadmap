import DeviceWatch from './DeviceWatch.jsx'
import Gate from './Gate.jsx'
import { AUTH_ENABLED } from '../lib/auth.js'
import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useTheme } from '../lib/theme.js'
import { BRAND } from '../data/extras.js'
import Search from './Search.jsx'
import Celebrate from './Celebrate.jsx'
import { useProgress } from '../lib/progress.js'
import { tally, levelOf } from '../lib/xp.js'
import { SECTIONS, sectionOf, itemOf, HOME_OF } from '../data/sections.js'

const MENUS = SECTIONS.filter((x) => x.id !== 'daily')

export default function Layout() {
  const { isDark, toggle } = useTheme()
  const prog = useProgress()
  const xp = tally(prog).xp
  const lv = levelOf(xp)
  const [search, setSearch] = useState(false)
  const [menu, setMenu] = useState(false)
  const loc = useLocation()
  const here = sectionOf(loc.pathname)
  const crumb = itemOf(loc.pathname, here)
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
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) && !document.activeElement?.isContentEditable && !document.activeElement?.closest('.cm-editor')) { e.preventDefault(); setSearch(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="shell">
      <header className="header">
        <div className="container">
          <Link to="/" className="brand" aria-label="Home">
            <img className="brand-mark" src="./favicon.svg" alt="" width="34" height="34" />
            <span className="wordmark">data<b>dhaba</b> <small>{BRAND.tagline}</small></span>
          </Link>
          <nav className="topnav" aria-label="Main">
            {SECTIONS.map((sec) => (
              <NavLink key={sec.id} to={HOME_OF[sec.id]} data-sec={sec.id} className={() => 'topnav-link' + (here?.id === sec.id ? ' active' : '')}>
                {sec.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-right">
            <button className="icon-btn search-btn" onClick={() => setSearch(true)} aria-label="Search">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
              <span>Search</span><kbd>Ctrl K</kbd>
            </button>
            <button className="icon-btn theme-btn" onClick={toggle} aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'} title="Theme">
              {isDark
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
            </button>
            <Link to="/progress" className="xp-pill" title={`${lv.name} · ${xp} XP`}><span>{lv.icon}</span><b>{xp}</b><small>XP</small></Link>
            {AUTH_ENABLED && (
              <Link to="/account" className="icon-btn" aria-label="Account" title="Account">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
              </Link>
            )}
            <Link to="/pro" className="btn btn-primary btn-sm hide-sm">Go Pro</Link>
            <button className="icon-btn menu-btn" onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            </button>
          </div>
        </div>
      </header>
      <nav className={'mobile-nav' + (menu ? ' open' : '')} aria-label="Mobile">
        <NavLink to="/daily" className="m-daily">Today's SQL challenge</NavLink>
        {MENUS.map((sec) => (
          <div key={sec.id} className="m-sec" data-sec={sec.id}>
            <div className="m-head">{sec.label}</div>
            <div className="m-items">{sec.items.map((i) => <NavLink key={i.to} to={i.to} end>{i.label}</NavLink>)}</div>
          </div>
        ))}
        <div className="m-items m-extra"><NavLink to="/progress">My progress · {xp} XP</NavLink><NavLink to="/pro">Pro</NavLink>{AUTH_ENABLED && <NavLink to="/account">Account</NavLink>}<button type="button" className="m-theme" onClick={toggle}>{isDark ? 'Light theme' : 'Dark theme'}</button></div>
      </nav>
      <main data-section={here?.id || 'home'}>
        {here && here.items.length > 1 && (
          <div className="sec-bar" data-sec={here.id}>
            <div className="container sec-tabs" role="navigation" aria-label={here.label + ' pages'}>
              {here.items.map((i) => (
                <Link key={i.to} to={i.to} className={'sec-tab' + (crumb?.to === i.to ? ' active' : '')} aria-current={crumb?.to === i.to ? 'page' : undefined}>{i.label}</Link>
              ))}
            </div>
          </div>
        )}
        <Gate><Outlet /></Gate>
      </main>
      <footer className="footer">
        <div className="container footer-grid">
          <div>
            <Link to="/" className="brand"><img className="brand-mark" src="./favicon.svg" alt="" width="34" height="34" /><span className="wordmark">data<b>dhaba</b></span></Link>
            <p style={{ marginTop: 12, maxWidth: 360 }}>A hands-on path into data engineering. Written by {BRAND.author}, {BRAND.authorRole}.</p>
          </div>
          {MENUS.map((sec) => <div key={sec.id} data-sec={sec.id}><h4>{sec.label}</h4>{sec.items.map((i) => <Link key={i.to} to={i.to}>{i.label === 'Overview' ? 'All of ' + sec.label : i.label}</Link>)}{sec.id === 'practice' && <Link to="/daily">Daily SQL challenge</Link>}</div>)}
          <div><h4>About</h4><Link to="/progress">My progress</Link><Link to="/about">About and mantras</Link><Link to="/pro">Pro</Link><a href={BRAND.portfolio} target="_blank" rel="noreferrer">Author's portfolio</a><a href={`mailto:${BRAND.email}`}>Contact</a></div>
        </div>
        <div className="container footer-base">
          <span>© {new Date().getFullYear()} {BRAND.name}</span>
          <nav aria-label="Legal"><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/pro">Pro waitlist</Link>{AUTH_ENABLED && <Link to="/account">Account</Link>}</nav>
        </div>
      </footer>
      {search && <Search onClose={() => setSearch(false)} />}
      <Celebrate />
      <DeviceWatch />
    </div>
  )
}
