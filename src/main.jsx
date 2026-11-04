import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

// The site uses hash routes (#/path). A plain in-page anchor such as #try would be read as a
// route and show the 404 page, so treat those as scroll targets instead.
// A sign-in link returns with #access_token=… (or #error=…). Keep it for the auth code before clearing the hash.
if (/^#(access_token|error)=|[#&](access_token|error_description)=/.test(location.hash)) { try { sessionStorage.setItem('dd:authhash', location.hash.slice(1)) } catch (e) { /* ignore */ } }
if (location.hash && !location.hash.startsWith('#/')) history.replaceState(null, '', location.pathname + location.search + '#/')
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href^="#"]')
  if (!a || e.defaultPrevented) return
  const h = a.getAttribute('href')
  if (h === '#' || h.startsWith('#/')) return
  e.preventDefault()
  document.getElementById(decodeURIComponent(h.slice(1)))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
})

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)
