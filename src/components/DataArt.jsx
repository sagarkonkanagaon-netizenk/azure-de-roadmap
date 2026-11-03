// Small animated "data objects" used as decoration: a 3D data cube, a database with orbiting rows,
// meshing gears and a pulsing node graph. Pure CSS/SVG, colour comes from --sec, motion stops
// when the visitor prefers reduced motion.

export function Cube({ size = 56 }) {
  const faces = ['{ }', 'SQL', '01', 'Δ', '⛁', '∑']
  return (
    <span className="art art-cube" style={{ '--s': size + 'px' }} aria-hidden="true">
      <span className="cube">
        {faces.map((f, i) => <span key={i} className={'face f' + i}>{f}</span>)}
      </span>
    </span>
  )
}

export function Database({ size = 56 }) {
  return (
    <span className="art art-db" style={{ '--s': size + 'px' }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <g className="db-body">
          <ellipse cx="32" cy="16" rx="16" ry="6" />
          <path d="M16 16v32c0 3.3 7.2 6 16 6s16-2.7 16-6V16" />
          <path d="M16 27c0 3.3 7.2 6 16 6s16-2.7 16-6M16 38c0 3.3 7.2 6 16 6s16-2.7 16-6" />
        </g>
      </svg>
      <span className="orbit"><i /><i /><i /></span>
    </span>
  )
}

const GEAR = 'M12 1.5l1.6 2.6 3-.6.6 3 2.6 1.6-1 2.9 1 2.9-2.6 1.6-.6 3-3-.6L12 22.5l-1.6-2.6-3 .6-.6-3-2.6-1.6 1-2.9-1-2.9 2.6-1.6.6-3 3 .6z'
export function Gears({ size = 56 }) {
  return (
    <span className="art art-gears" style={{ '--s': size + 'px' }} aria-hidden="true">
      <svg viewBox="0 0 24 24" className="g1"><path d={GEAR} /><circle cx="12" cy="12" r="3.2" /></svg>
      <svg viewBox="0 0 24 24" className="g2"><path d={GEAR} /><circle cx="12" cy="12" r="3.2" /></svg>
    </span>
  )
}

export function Graph({ size = 56 }) {
  const n = [[32, 10], [12, 30], [52, 30], [22, 54], [44, 54]]
  const e = [[0, 1], [0, 2], [1, 3], [2, 4], [1, 2], [3, 4]]
  return (
    <span className="art art-graph" style={{ '--s': size + 'px' }} aria-hidden="true">
      <svg viewBox="0 0 64 64" width={size} height={size}>
        <g className="spin">
          {e.map(([a, b], i) => <line key={i} x1={n[a][0]} y1={n[a][1]} x2={n[b][0]} y2={n[b][1]} />)}
          {n.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.2" style={{ animationDelay: i * 0.35 + 's' }} />)}
        </g>
      </svg>
    </span>
  )
}

const BY_SECTION = { learn: Cube, practice: Database, interview: Graph, daily: Gears }
export function SectionArt({ id, size }) {
  const C = BY_SECTION[id] || Cube
  return <C size={size} />
}

// Drifting data glyphs for big hero areas.
const GLYPHS = ['SELECT', '{ }', '0101', 'JOIN', '⛁', 'Δ', 'WHERE', '∑', '[ ]', 'GROUP BY', '→', '1 0 1', 'NULL', '⚙', 'ROW_NUMBER()', 'λ']
export function DataRain() {
  return (
    <div className="data-rain" aria-hidden="true">
      {GLYPHS.map((g, i) => (
        <span key={i} style={{ left: ((i * 61) % 100) + '%', animationDelay: -(i * 1.7) + 's', animationDuration: 14 + (i % 5) * 3 + 's', fontSize: 0.7 + (i % 3) * 0.18 + 'rem' }}>{g}</span>
      ))}
    </div>
  )
}
