import { useEffect, useRef, useState } from 'react'
import { useProgress } from '../lib/progress.js'
import { tally, levelOf, badgesOf, POINTS } from '../lib/xp.js'

const LABEL = { chapter: 'Chapter read', sql: 'SQL question solved', py: 'Python question solved', spark: 'PySpark answer known', scenario: 'Scenario practised', drill: 'Incident resolved', project: 'Project shipped', check: 'Checklist item done', card: 'Flashcard learned', daily: 'Daily challenge solved' }

function confetti(big) {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const c = document.createElement('canvas')
  c.className = 'confetti'
  const dpr = window.devicePixelRatio || 1
  c.width = innerWidth * dpr; c.height = innerHeight * dpr
  document.body.appendChild(c)
  const ctx = c.getContext('2d'); ctx.scale(dpr, dpr)
  const colors = ['#d8894f', '#b9c0c9', '#f2c14b', '#7ee0c8', '#f2b14b', '#ff7a6b']
  const N = big ? 180 : 70
  const parts = Array.from({ length: N }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 120, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * (big ? 16 : 10), vy: -Math.random() * (big ? 16 : 11) - 4,
    s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: colors[(Math.random() * colors.length) | 0],
  }))
  let t = 0
  const tick = () => {
    t++
    ctx.clearRect(0, 0, innerWidth, innerHeight)
    for (const p of parts) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, 1 - t / 140)
      ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore()
    }
    if (t < 140) requestAnimationFrame(tick); else c.remove()
  }
  requestAnimationFrame(tick)
}

// Watches progress; when XP goes up it shows a toast, confetti for big wins, and a card on level-up or a new badge.
export default function Celebrate() {
  const p = useProgress()
  const prev = useRef(null)
  const [toast, setToast] = useState(null)
  const [big, setBig] = useState(null)
  const [badge, setBadge] = useState(null)
  const tRef = useRef(0)
  useEffect(() => () => clearTimeout(tRef.current), [])
  useEffect(() => {
    const t = tally(p)
    const badges = badgesOf(p).filter((b) => b.earned).map((b) => b.id)
    const before = prev.current
    prev.current = { t, badges }
    if (!before || t.xp <= before.t.xp) return
    const delta = t.xp - before.t.xp
    const kind = Object.keys(t.n).find((k) => t.n[k] > before.t.n[k])
    const lvBefore = levelOf(before.t.xp); const lv = levelOf(t.xp)
    const newBadge = badgesOf(p).find((b) => b.earned && !before.badges.includes(b.id))
    setToast({ delta, label: kind ? LABEL[kind] : 'Quiz score', id: Date.now() })
    clearTimeout(tRef.current); tRef.current = setTimeout(() => setToast(null), 2600)
    if (lv.i > lvBefore.i) { setBig({ type: 'level', lv }); confetti(true) }
    if (newBadge) { setBadge({ ...newBadge, key: Date.now() }); if (lv.i <= lvBefore.i) confetti(true) }
    if (lv.i <= lvBefore.i && !newBadge && kind && POINTS[kind] >= 20) confetti(false)
  }, [p])
  useEffect(() => { if (!badge) return; const x = setTimeout(() => setBadge(null), 4500); return () => clearTimeout(x) }, [badge])
  return (
    <>
      {toast && <div key={toast.id} className="xp-toast" role="status" onAnimationEnd={(e) => { if (e.animationName === "toast-out") setToast(null) }}><b>+{toast.delta} XP</b><span>{toast.label}</span></div>}
      {badge && <div key={badge.key} className="badge-pop" role="status" onClick={() => setBadge(null)}><span className="b-ico">{badge.icon}</span><div><div className="eyebrow" style={{ margin: 0 }}>Badge earned</div><b>{badge.name}</b><small>{badge.desc}</small></div></div>}
      {big && (
        <div className="levelup" role="dialog" aria-label={big.type === 'level' ? 'Level up' : 'Badge earned'} onClick={() => setBig(null)}>
          <div className="levelup-card" onClick={(e) => e.stopPropagation()}>
            <div className="levelup-ico">{big.type === 'level' ? big.lv.icon : big.b.icon}</div>
            <div className="eyebrow" style={{ justifyContent: 'center' }}>{big.type === 'level' ? 'Level up' : 'Badge earned'}</div>
            <h2>{big.type === 'level' ? big.lv.name : big.b.name}</h2>
            <p className="muted">{big.type === 'level' ? (big.lv.next ? `${big.lv.next.xp} XP to ${big.lv.next.name}. Keep going.` : 'You reached the top. Go get that offer.') : big.b.desc}</p>
            <button className="btn btn-primary" onClick={() => setBig(null)}>Keep learning</button>
          </div>
        </div>
      )}
    </>
  )
}
