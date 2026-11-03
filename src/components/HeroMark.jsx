// The Data Dhaba bowl: a letter D tipped on its back. It wobbles and hot data bits rise out of it.
// Pure SVG + CSS; motion stops when the visitor prefers reduced motion.
const BITS = Array.from({ length: 16 }, (_, i) => ({
  s: 7 + ((i * 7) % 12),
  x: -50 + ((i * 37) % 100),
  d: (2.2 + (i % 5) * 0.4).toFixed(2),
  t: (-(i * 0.33)).toFixed(2),
  x1: (i % 2 ? 1 : -1) * (8 + ((i * 13) % 24)),
  x2: (i % 3 ? -1 : 1) * (16 + ((i * 11) % 40)),
  pink: i % 4 === 0,
}))

export default function HeroMark({ size = 132 }) {
  return (
    <svg className="hero-mark" viewBox="-160 -230 320 360" width={size} height={size * 1.125} aria-hidden="true">
      <defs>
        <linearGradient id="hm-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7aa8" /><stop offset=".5" stopColor="#ff3d7f" /><stop offset="1" stopColor="#c0145a" />
        </linearGradient>
      </defs>
      <g transform="rotate(-10)">
        <g className="hm-bits">
          {BITS.map((b, i) => (
            <rect key={i} className="hm-bit" x={b.x} y={-40} width={b.s} height={b.s} rx={b.s / 5}
              fill={b.pink ? '#ff3d7f' : 'var(--hm-teal)'}
              style={{ '--d': b.d + 's', '--t': b.t + 's', '--x1': b.x1 + 'px', '--x2': b.x2 + 'px' }} />
          ))}
        </g>
        <g className="hm-bowl">
          <path d="M-120 -20 H120 V0 A120 110 0 0 1 -120 0 Z M-78 4 H78 A78 66 0 0 1 -78 4 Z" fillRule="evenodd" fill="url(#hm-body)" />
          <path d="M-112 -14 H112" stroke="#fff" strokeOpacity=".55" strokeWidth="4" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  )
}
