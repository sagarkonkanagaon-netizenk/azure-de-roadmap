// Raw data for Pro project 1 (RasoiRun orders lakehouse). Generated in the browser from a fixed seed,
// so every learner downloads exactly the same files and the checkpoint numbers below always match.
// The mess is deliberate: replays, late arrivals, bad rows, schema drift and messy city names.

function rng(seed) {
  let a = seed >>> 0
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}
const pad = (n, w = 2) => String(n).padStart(w, '0')
const fmt = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` }
const DAY0 = Date.UTC(2026, 9, 1) // 2026-10-01, times are local (IST) wall-clock with no zone
const DAYS = ['2026-10-01', '2026-10-02', '2026-10-03']
const MIN = 60_000

const CUISINES = ['North Indian', 'South Indian', 'Biryani', 'Chinese', 'Pizza', 'Cafe', 'Desserts', 'Healthy']
const NAMES = ['Tandoor Tales', 'Dosa Junction', 'Biryani Bros', 'Wok Express', 'Slice Street', 'Chai Point Cafe', 'Mithai Lane', 'Green Bowl', 'Paratha Plaza', 'Idli Factory', 'Dum Pukht House', 'Noodle Nest', 'Crust and Co', 'Filter Kaapi Co', 'Kulfi Corner', 'Salad Studio', 'Punjab Grill Hub', 'Udupi Corner', 'Hyderabadi Handi', 'Momo Magic']
// clean city -> messy spellings seen in the source system
const CITY_MESS = {
  Bengaluru: ['Bengaluru', 'Bangalore', ' bengaluru', 'BANGALORE'],
  Mumbai: ['Mumbai', 'Bombay', 'mumbai '],
  Delhi: ['Delhi', 'New Delhi', 'delhi'],
  Hyderabad: ['Hyderabad', 'hyderabad'],
  Pune: ['Pune', 'PUNE'],
}
const CITIES = Object.keys(CITY_MESS)

export function cleanCity(s) {
  const t = s.trim().toLowerCase()
  const map = { bangalore: 'Bengaluru', bengaluru: 'Bengaluru', bombay: 'Mumbai', mumbai: 'Mumbai', 'new delhi': 'Delhi', delhi: 'Delhi', hyderabad: 'Hyderabad', pune: 'Pune' }
  return map[t] || t.replace(/\b\w/g, (c) => c.toUpperCase())
}

function csv(rows, cols) { return [cols.join(','), ...rows.map((r) => cols.map((c) => { const v = r[c] ?? ''; return /[",]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : v }).join(','))].join('\n') + '\n' }

export function buildRasoiRun() {
  const r = rng(20261001)
  const pick = (a) => a[Math.floor(r() * a.length)]
  const int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1))

  // restaurants: v1 on 2026-10-01, v2 on 2026-10-03 (one moves city, one renamed, one new, spellings change)
  const rest = Array.from({ length: 40 }, (_, i) => ({ restaurant_id: 'r' + pad(i + 1, 3), name: NAMES[i % NAMES.length] + (i >= NAMES.length ? ' ' + CITIES[i % 5] : ''), city: CITIES[i % 5], cuisine: CUISINES[i % CUISINES.length] }))
  rest[6].city = 'Pune' // r007 starts in Pune
  const messy = (c) => pick(CITY_MESS[c])
  const v1 = rest.map((x) => ({ ...x, city: messy(x.city) }))
  const restV2 = rest.map((x) => ({ ...x }))
  restV2[6].city = 'Mumbai' // r007 moves Pune -> Mumbai
  restV2[11].name = 'Noodle Nest Express' // r012 renamed
  restV2.push({ restaurant_id: 'r041', name: 'Rasoi Test Kitchen', city: 'Bengaluru', cuisine: 'Healthy' })
  const v2 = restV2.map((x) => ({ ...x, city: messy(x.city) }))
  const restCols = ['restaurant_id', 'name', 'city', 'cuisine']

  const files = { 0: [], 1: [], 2: [] }
  const deliveries = []
  const bad = []
  let seq = 0
  const addOrder = (dayIdx, fileOverride) => {
    seq += 1
    const id = 'RR' + pad(seq, 6)
    const active = dayIdx === 2 ? restV2 : rest
    const rid = pick(active).restaurant_id
    const ts = DAY0 + dayIdx * 1440 * MIN + int(8 * 60, 23 * 60 + 30) * MIN + int(0, 59) * 1000
    const amount = Math.round((120 + r() * 1380) * 100) / 100
    const cust = 'c' + pad(int(1, 9000), 5)
    const roll = r()
    const final = roll < 0.85 ? 'delivered' : roll < 0.95 ? 'cancelled' : null
    const ev = [{ order_id: id, customer_id: cust, restaurant_id: rid, order_ts: fmt(ts), amount, status: 'placed', updated_at: fmt(ts) }]
    let end = ts
    if (final) {
      end = ts + int(25, 60) * MIN + int(0, 59) * 1000
      ev.push({ ...ev[0], status: final, updated_at: fmt(end) })
      if (final === 'delivered') deliveries.push({ order_id: id, rider_id: 'rd' + pad(int(1, 300), 3), picked_ts: fmt(ts + int(12, 20) * MIN), delivered_ts: fmt(end) })
    }
    ev.forEach((e, k) => {
      let f = fileOverride ?? (k === 0 ? dayIdx : Math.min(2, Math.floor((end - DAY0) / (1440 * MIN))))
      files[f].push(e)
    })
  }
  for (let d = 0; d < 3; d++) for (let i = 0; i < 1200; i++) addOrder(d)
  for (let i = 0; i < 30; i++) addOrder(0, 2) // late arrivals: day-1 orders that only land in the day-3 file

  // bad rows (each is its own order, so they never collide with good ones)
  for (let f = 0; f < 3; f++) {
    const base = () => ({ order_id: 'RRX' + pad(++seq, 6), customer_id: 'c' + pad(int(1, 9000), 5), restaurant_id: pick(rest).restaurant_id, order_ts: fmt(DAY0 + f * 1440 * MIN + int(600, 1300) * MIN), amount: Math.round(200 + r() * 600), status: 'placed' })
    for (let i = 0; i < 5; i++) { const b = base(); b.order_id = null; b.updated_at = b.order_ts; bad.push(b); files[f].push(b) }
    for (let i = 0; i < 5; i++) { const b = base(); const d = DAYS[f].split('-'); b.order_ts = `${d[2]}/${d[1]}/${d[0]} ${pad(int(10, 22))}:${pad(int(0, 59))}`; b.updated_at = b.order_ts; bad.push(b); files[f].push(b) }
    for (let i = 0; i < 3; i++) { const b = base(); b.amount = -b.amount; b.updated_at = b.order_ts; bad.push(b); files[f].push(b) }
    for (let i = 0; i < 3; i++) { const b = base(); b.restaurant_id = 'r999'; b.updated_at = b.order_ts; bad.push(b); files[f].push(b) }
  }

  // replays: about 2% of good events sent twice, in the same file
  for (let f = 0; f < 3; f++) {
    const good = files[f].filter((e) => e.order_id && !bad.includes(e))
    const n = Math.round(good.length * 0.02)
    for (let i = 0; i < n; i++) files[f].push({ ...pick(good) })
  }
  // day 3 schema drift: a new coupon_code field, and some amounts arrive as text like "₹349.00"
  files[2] = files[2].map((e) => {
    const x = { ...e }
    if (e.order_id && !bad.includes(e) && r() < 0.3) x.coupon_code = pick(['WELCOME50', 'RASOI20', 'FREEDEL', 'WEEKEND'])
    if (typeof x.amount === 'number' && x.amount > 0 && r() < 0.2) x.amount = '₹' + x.amount.toFixed(2)
    return x
  })
  // shuffle each file so events are not in order (files never are)
  for (let f = 0; f < 3; f++) { const a = files[f]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } }
  // a few duplicate delivery rows
  const delOut = [...deliveries]
  for (let i = 0; i < 25; i++) delOut.push({ ...pick(deliveries) })

  const out = {
    'orders/orders_2026-10-01.json': files[0].map((e) => JSON.stringify(e)).join('\n') + '\n',
    'orders/orders_2026-10-02.json': files[1].map((e) => JSON.stringify(e)).join('\n') + '\n',
    'orders/orders_2026-10-03.json': files[2].map((e) => JSON.stringify(e)).join('\n') + '\n',
    'restaurants/restaurants_2026-10-01.csv': csv(v1, restCols),
    'restaurants/restaurants_2026-10-03.csv': csv(v2, restCols),
    'deliveries/deliveries.csv': csv(delOut, ['order_id', 'rider_id', 'picked_ts', 'delivered_ts']),
  }
  return { files: out, expected: expected(files, v1, v2, delOut) }
}

// The reference solution, in plain JS, so the checkpoints on the page are exact.
function expected(files, v1, v2, del) {
  const all = [...files[0], ...files[1], ...files[2]]
  const TS = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/
  const amt = (a) => Number(String(a).replace(/[^0-9.-]/g, ''))
  const known = new Set([...v1, ...v2].map((x) => x.restaurant_id))
  const isBad = (e) => !e.order_id || !TS.test(e.order_ts) || !(amt(e.amount) >= 0) || !known.has(e.restaurant_id)
  const quarantine = all.filter(isBad).length
  const latest = new Map()
  for (const e of all) { if (isBad(e)) continue; const c = latest.get(e.order_id); if (!c || e.updated_at > c.updated_at) latest.set(e.order_id, e) }
  const silver = [...latest.values()]
  const cityAt = (rid, ts) => { const v = ts >= '2026-10-03 00:00:00' ? v2 : v1; const row = v.find((x) => x.restaurant_id === rid) || v1.find((x) => x.restaurant_id === rid); return cleanCity(row.city) }
  const delivered = silver.filter((e) => e.status === 'delivered')
  const rev = {}
  for (const e of delivered) { const k = e.order_ts.slice(0, 10) + '|' + cityAt(e.restaurant_id, e.order_ts); rev[k] = (rev[k] || 0) + amt(e.amount) }
  const dmap = new Map(del.map((d) => [d.order_id, d]))
  let on = 0, n = 0
  for (const e of delivered) { const d = dmap.get(e.order_id); if (!d) continue; n++; const mins = (Date.parse(d.delivered_ts.replace(' ', 'T') + 'Z') - Date.parse(e.order_ts.replace(' ', 'T') + 'Z')) / 60000; if (mins <= 45) on++ }
  const round2 = (x) => Math.round(x * 100) / 100
  return {
    bronzeRows: all.length,
    quarantineRows: quarantine,
    silverOrders: silver.length,
    deliveredOrders: delivered.length,
    revenueBlr1: round2(rev['2026-10-01|Bengaluru'] || 0),
    revenuePuneDay3: round2(rev['2026-10-03|Pune'] || 0),
    revenueTotal: round2(Object.values(rev).reduce((a, b) => a + b, 0)),
    dimRows: v2.length + v2.filter((x) => { const o = v1.find((y) => y.restaurant_id === x.restaurant_id); return o && (o.name !== x.name || o.cuisine !== x.cuisine || cleanCity(o.city) !== cleanCity(x.city)) }).length,
    dimCurrent: v2.length,
    onTimePct: round2((on / n) * 100),
    deliveriesRows: del.length,
  }
}
