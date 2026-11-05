import { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { renderMd } from '../lib/md.js'
import { runPython, isPyReady } from '../lib/py.js'

// Runs a Python block in place and shows its output under it. Blocks on a page share one
// Python session, like notebook cells, so a later block can use what an earlier one defined.
async function runInline(block, btn, code) {
  let out = block.querySelector('.run-out')
  if (!out) { out = document.createElement('pre'); out.className = 'run-out'; out.setAttribute('aria-live', 'polite'); block.appendChild(out) }
  btn.disabled = true
  out.className = 'run-out busy'
  out.textContent = isPyReady() ? 'Running…' : 'Starting Python in your browser (first run takes a few seconds)…'
  const t0 = performance.now()
  const res = await runPython(code, null, { show: true })
  btn.disabled = false
  const text = (res.out || '').replace(/\n+$/, '')
  if (res.error) { out.className = 'run-out err'; out.textContent = (text ? text + '\n' : '') + res.error }
  else { out.className = 'run-out ok'; out.textContent = text || '(ran fine, nothing printed)' }
  out.dataset.ms = Math.round(performance.now() - t0) + ' ms'
}

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
      } else if (btn.hasAttribute('data-try') && block.dataset.run === 'python') {
        runInline(block, btn, code)
      } else if (btn.hasAttribute('data-try')) {
        try { sessionStorage.setItem('z2h:scratch', code) } catch (err) { /* ignore */ }
        navigate('/practice/sql/scratch')
      }
    }
    // In an editable Python block: Tab indents, Ctrl/Cmd+Enter runs it, Escape leaves the editor.
    const onKey = (e) => {
      const code = e.target.closest?.('code[contenteditable]')
      if (!code) return
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); document.execCommand('insertText', false, '    ') }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); code.closest('.codeblock')?.querySelector('button[data-try]')?.click() }
      else if (e.key === 'Escape') code.blur()
    }
    el.addEventListener('click', onClick)
    el.addEventListener('keydown', onKey)
    return () => { el.removeEventListener('click', onClick); el.removeEventListener('keydown', onKey) }
  }, [html, navigate])
  return <div ref={ref} className={className} dangerouslySetInnerHTML={{ __html: html }} />
}
