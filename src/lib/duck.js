import * as duckdb from '@duckdb/duckdb-wasm'

// The 34 MB engine is fetched from jsDelivr (cached by the browser after the first visit).
// Set VITE_WASM_BASE to serve it yourself, e.g. from your own CDN.
const WASM_BASE = import.meta.env.VITE_WASM_BASE || 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm@1.32.0/dist/'
const WORKER_BASE = new URL(import.meta.env.BASE_URL + 'vendor/duckdb/', window.location.href).href

let dbPromise = null

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const bundles = {
        mvp: { mainModule: WASM_BASE + 'duckdb-mvp.wasm', mainWorker: WORKER_BASE + 'duckdb-browser-mvp.worker.js' },
        eh: { mainModule: WASM_BASE + 'duckdb-eh.wasm', mainWorker: WORKER_BASE + 'duckdb-browser-eh.worker.js' },
      }
      const bundle = await duckdb.selectBundle(bundles)
      const worker = new Worker(bundle.mainWorker)
      const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker)
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
      await db.open({ query: { castBigIntToDouble: true, castDecimalToDouble: true } })
      return db
    })()
    dbPromise.catch(() => { dbPromise = null })
  }
  return dbPromise
}

let seq = 0

// In the browser build, CURRENT_DATE and NOW() live in the ICU extension, which DuckDB would
// download from extensions.duckdb.org on first use. Swap them for literals (outside strings) so
// the labs work offline and give the same answer all day.
function pad(n) { return String(n).padStart(2, '0') }
export function pinClock(sql, d = new Date()) {
  const day = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const ts = `${day} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  return sql.split(/('(?:[^']|'')*'|--[^\n]*)/).map((part, i) => (i % 2 ? part : part
    .replace(/\bcurrent_date\b(\s*\(\s*\))?/gi, `DATE '${day}'`)
    .replace(/\b(?:current_timestamp|localtimestamp)\b(\s*\(\s*\))?|\b(?:now|get_current_timestamp)\s*\(\s*\)/gi, `TIMESTAMP '${ts}'`)
    .replace(/\btoday\s*\(\s*\)/gi, `DATE '${day}'`))).join('')
}

function fmt(v, typeId) {
  if (v === null || v === undefined) return null
  if (typeof v === 'bigint') return Number(v)
  if (v instanceof Date) return v.toISOString().replace('T', ' ').replace(/\.000Z$|Z$/, '')
  // Arrow: 8 = Date, 10 = Timestamp, 11 = Time, 12 = Interval
  if (typeId === 8 && typeof v === 'number') return new Date(v).toISOString().slice(0, 10)
  if (typeId === 10 && typeof v === 'number') return new Date(v).toISOString().replace('T', ' ').replace(/\.000Z$/, '').replace(/ 00:00:00$/, ' 00:00:00')
  if (typeof v === 'object' && v && typeof v.toArray === 'function') return JSON.stringify(Array.from(v.toArray(), (x) => fmt(x)))
  if (typeof v === 'object') { try { return JSON.stringify(v, (k, x) => typeof x === 'bigint' ? Number(x) : x) } catch (e) { return String(v) } }
  return v
}

function toResult(table) {
  if (!table) return null
  const fields = table.schema.fields
  const cols = fields.map((f) => f.name)
  const types = fields.map((f) => f.type.typeId)
  const rows = []
  for (const r of table.toArray()) {
    const obj = r.toJSON ? r.toJSON() : r
    rows.push(cols.map((c, i) => fmt(obj[c], types[i])))
  }
  return { cols, rows }
}

// Split on semicolons that are outside quotes and comments.
export function splitSql(sql) {
  const out = []
  let cur = ''
  let q = null
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    const nx = sql[i + 1]
    if (!q && ch === '-' && nx === '-') { const j = sql.indexOf('\n', i); const end = j === -1 ? sql.length : j; cur += sql.slice(i, end); i = end - 1; continue }
    if (!q && ch === '/' && nx === '*') { const j = sql.indexOf('*/', i + 2); const end = j === -1 ? sql.length : j + 2; cur += sql.slice(i, end); i = end - 1; continue }
    if (q) { if (ch === q) q = null } else if (ch === "'" || ch === '"') q = ch
    if (ch === ';' && !q) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out.filter((s) => s.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim())
}

/**
 * Run SQL in an isolated schema. Returns { result, error, ms }.
 * setup runs first; then user SQL (all statements, last result kept); then optional check query.
 */
export async function runIsolated({ setup = '', sql = '', check = '' }) {
  const db = await getDb()
  const conn = await db.connect()
  const schema = `lab_${Date.now().toString(36)}_${seq++}`
  const t0 = performance.now()
  try {
    await conn.query(`CREATE SCHEMA ${schema}; SET schema = '${schema}'; SET search_path = '${schema},main';`)
    for (const s of splitSql(pinClock(setup))) await conn.query(s)
    let last = null
    let stage = 'your query'
    try {
      for (const s of splitSql(pinClock(sql))) last = await conn.query(s)
      stage = 'check'
      if (check) last = await conn.query(pinClock(check))
    } catch (e) {
      return { error: cleanErr(e), stage, ms: performance.now() - t0 }
    }
    return { result: toResult(last), ms: performance.now() - t0 }
  } catch (e) {
    return { error: cleanErr(e), stage: 'setup', ms: performance.now() - t0 }
  } finally {
    try { await conn.query(`SET schema = 'main'; SET search_path = 'main'; DROP SCHEMA IF EXISTS ${schema} CASCADE;`) } catch (e) { /* ignore */ }
    await conn.close()
  }
}

function cleanErr(e) {
  return String(e && e.message ? e.message : e).replace(/^Error: /, '').replace(new RegExp('lab_[a-z0-9_]+\\.', 'g'), '')
}

function norm(v) {
  if (v === null || v === undefined) return '∅'
  if (typeof v === 'number') return (Math.round(v * 100) / 100).toFixed(2)
  if (typeof v === 'boolean') return v ? 'true' : 'false'
  const s = String(v)
  if (/^-?\d+(\.\d+)?$/.test(s)) return (Math.round(Number(s) * 100) / 100).toFixed(2)
  return s.replace(/ 00:00:00$/, '')
}

/** Compare two results as multisets of rows; lenient about column names and column order. */
export function compareResults(got, want) {
  if (!got) return { ok: false, why: 'Your SQL did not return a result set. Make sure the last statement is a SELECT.' }
  if (got.rows.length !== want.rows.length) return { ok: false, why: `Expected ${want.rows.length} row${want.rows.length === 1 ? '' : 's'}, got ${got.rows.length}.` }
  if (got.cols.length !== want.cols.length) return { ok: false, why: `Expected ${want.cols.length} column${want.cols.length === 1 ? '' : 's'}, got ${got.cols.length}.` }
  const key = (r) => r.map(norm).join('␟')
  const keySorted = (r) => r.map(norm).sort().join('␟')
  const a = got.rows.map(key).sort(); const b = want.rows.map(key).sort()
  if (a.every((x, i) => x === b[i])) return { ok: true }
  const c = got.rows.map(keySorted).sort(); const d = want.rows.map(keySorted).sort()
  if (c.every((x, i) => x === d[i])) return { ok: true, note: 'Same values, different column order.' }
  return { ok: false, why: 'Same shape, but some values differ. Compare your output with the expected result.' }
}
