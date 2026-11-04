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
      if (btn.hasAttribute('data-opt')) {
        const q = btn.closest('[data-quiz]')
        if (!q || q.classList.contains('answered')) return
        q.classList.add('answered')
        const ok = btn.dataset.ok === '1'
        btn.classList.add(ok ? 'right' : 'wrong')
        q.querySelectorAll('[data-opt]').forEach((b) => { if (b.dataset.ok === '1') b.classList.add('right'); b.setAttribute('aria-disabled', 'true') })
        const why = q.querySelector('.quiz-why'); if (why) { why.hidden = false; why.insertAdjacentHTML('afterbegin', ok ? '<b>Right.</b> ' : '<b>Not quite.</b> ') }
        return
      }
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
