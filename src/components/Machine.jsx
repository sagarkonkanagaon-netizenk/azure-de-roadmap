// Animated medallion pipeline: sources → bronze → silver → gold → consumers.
const P = {
  a: 'M70 70 C 130 70, 140 150, 200 150',
  b: 'M70 150 L 200 150',
  c: 'M70 230 C 130 230, 140 150, 200 150',
  bs: 'M262 150 L 330 150',
  sg: 'M392 150 L 460 150',
  g1: 'M522 150 C 570 150, 570 75, 620 75',
  g2: 'M522 150 L 620 150',
  g3: 'M522 150 C 570 150, 570 225, 620 225',
  q: 'M330 150 C 300 150, 300 250, 360 262',
}

function Node({ x, y, w = 62, h = 62, fill, label, sub, rx = 16 }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} opacity=".16" />
      <rect x={x} y={y} width={w} height={h} rx={rx} fill="none" stroke={fill} strokeWidth="2" />
      <text x={x + w / 2} y={y + h / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize="13" fill="currentColor">{label}</text>
      {sub && <text x={x + w / 2} y={y + h + 16} textAnchor="middle" fontSize="10.5" fill="currentColor" opacity=".6">{sub}</text>}
    </g>
  )
}

function Packet({ path, dur, begin, color, r = 4.5 }) {
  return (
    <circle r={r} fill={color} opacity="0">
      <set attributeName="opacity" to="1" begin={begin} />
      <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={path} />
    </circle>
  )
}

export default function Machine() {
  const flow = { fill: 'none', stroke: 'currentColor', strokeOpacity: 0.22, strokeWidth: 2, className: 'flow' }
  return (
    <div className="machine card" aria-label="Animated data pipeline: sources flow into bronze, silver and gold layers, with an orchestrator and a data quality gate.">
      <svg viewBox="0 0 700 310" role="img">
        <title>Medallion pipeline</title>
        <g fontSize="11" fill="currentColor" opacity=".75">
          <text x="18" y="74">API</text>
          <text x="18" y="154">Kafka</text>
          <text x="18" y="234">Files</text>
        </g>
        <circle cx="62" cy="70" r="6" fill="#64748b" /><circle cx="62" cy="150" r="6" fill="#64748b" /><circle cx="62" cy="230" r="6" fill="#64748b" />
        {Object.entries(P).map(([k, d]) => <path key={k} d={d} {...flow} strokeDasharray={k === 'q' ? '3 6' : '6 10'} stroke={k === 'q' ? '#ef4444' : 'currentColor'} strokeOpacity={k === 'q' ? 0.5 : 0.22} />)}
        <rect x="190" y="18" width="345" height="34" rx="10" fill="none" stroke="currentColor" strokeOpacity=".25" strokeDasharray="4 5" />
        <text x="362" y="40" textAnchor="middle" fontSize="11.5" fill="currentColor" opacity=".75">Orchestrator · schedules, retries, SLAs</text>
        <Node x={200} y={119} fill="#c47f45" label="Bronze" sub="raw, append-only" />
        <Node x={330} y={119} fill="#9aa7b6" label="Silver" sub="clean, deduped" />
        <Node x={460} y={119} fill="#e2ad2b" label="Gold" sub="modeled for BI" />
        <g fontSize="11" fill="currentColor" opacity=".8">
          <text x="628" y="79">BI</text><text x="628" y="154">ML</text><text x="628" y="229">Apps</text>
        </g>
        <rect x="360" y="248" width="96" height="28" rx="8" fill="#ef4444" opacity=".12" />
        <rect x="360" y="248" width="96" height="28" rx="8" fill="none" stroke="#ef4444" strokeOpacity=".6" />
        <text x="408" y="266" textAnchor="middle" fontSize="11" fill="#ef4444" fontWeight="600">quarantine</text>
        <Packet path={P.a} dur="2.4s" begin="0s" color="#94a3b8" />
        <Packet path={P.b} dur="2s" begin=".6s" color="#94a3b8" />
        <Packet path={P.c} dur="2.4s" begin="1.1s" color="#94a3b8" />
        <Packet path={P.bs} dur="1.4s" begin=".3s" color="#c47f45" />
        <Packet path={P.bs} dur="1.4s" begin="1s" color="#c47f45" />
        <Packet path={P.sg} dur="1.4s" begin=".7s" color="#9aa7b6" />
        <Packet path={P.sg} dur="1.4s" begin="1.4s" color="#9aa7b6" />
        <Packet path={P.g1} dur="1.8s" begin=".2s" color="#e2ad2b" />
        <Packet path={P.g2} dur="1.6s" begin=".9s" color="#e2ad2b" />
        <Packet path={P.g3} dur="1.8s" begin="1.5s" color="#e2ad2b" />
        <Packet path={P.q} dur="3s" begin="1.2s" color="#ef4444" r={4} />
      </svg>
    </div>
  )
}
