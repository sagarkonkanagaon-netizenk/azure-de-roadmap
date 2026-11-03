import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { renderMd } from '../lib/md.js'

export default function Markdown({ md, className = 'prose' }) {
  const html = useMemo(() => renderMd(md), [md])
  const ref = useRef(null)
  const navigate = useNavigate()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onClick = (e) => {
      const btn = e.target.closest('button')
      if (!btn) return
      const block = btn.closest('.codeblock')
      if (!block) return
      const code = block.querySelector('code').innerText
      if (btn.hasAttribute('data-copy')) {
        navigator.clipboard?.writeText(code).then(() => { btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = 'Copy' }, 1200) }).catch(() => {})
      } else if (btn.hasAttribute('data-try')) {
        try { sessionStorage.setItem('z2h:scratch', code) } catch (err) { /* ignore */ }
        navigate('/practice/sql/scratch')
      }
    }
    el.addEventListener('click', onClick)
    return () => el.removeEventListener('click', onClick)
  }, [html, navigate])
  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
