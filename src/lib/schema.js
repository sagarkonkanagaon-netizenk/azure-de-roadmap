// Reads CREATE TABLE and INSERT statements from a problem's setup SQL so learners can see
// every table, its columns, types and row count without running anything.

function splitTop(s) {
  const out = []; let depth = 0, q = false, cur = ''
  for (const ch of s) {
    if (ch === "'") q = !q
    if (!q && ch === '(') depth++
    if (!q && ch === ')') depth--
    if (!q && depth === 0 && ch === ',') { out.push(cur.trim()); cur = ''; continue }
    cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

function body(sql, start) {
  let depth = 0, q = false
  for (let i = start; i < sql.length; i++) {
    const ch = sql[i]
    if (ch === "'") q = !q
    if (q) continue
    if (ch === '(') depth++
    if (ch === ')') { depth--; if (depth === 0) return [sql.slice(start + 1, i), i] }
  }
  return [sql.slice(start + 1), sql.length]
}

function countRows(sql, name) {
  const re = new RegExp(`INSERT\\s+INTO\\s+${name}\\b[^;]*?VALUES`, 'gi')
  let n = 0, m
  while ((m = re.exec(sql))) {
    let depth = 0, q = false
    for (let i = re.lastIndex; i < sql.length; i++) {
      const ch = sql[i]
      if (ch === "'") q = !q
      if (q) continue
      if (ch === '(') { if (depth === 0) n++; depth++ }
      else if (ch === ')') depth--
      else if (ch === ';' && depth === 0) break
    }
  }
  return n
}

export function parseSchema(setup = '', only) {
  const tables = []
  const re = /CREATE\s+(?:OR\s+REPLACE\s+)?TABLE\s+(\w+)\s*\(/gi
  let m
  while ((m = re.exec(setup))) {
    const name = m[1]
    const [inside, end] = body(setup, re.lastIndex - 1)
    re.lastIndex = end
    const cols = splitTop(inside)
      .filter((c) => !/^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(c))
      .map((c) => { const [col, ...rest] = c.split(/\s+/); return { name: col, type: rest.join(' ').replace(/\s+(NOT NULL|PRIMARY KEY).*$/i, '').toLowerCase() } })
    tables.push({ name, cols, rows: countRows(setup, name) })
  }
  const pick = only && only.length ? tables.filter((t) => only.includes(t.name)) : tables
  return pick.length ? pick : tables
}

// Plain-language notes for the tables that show up most.
export const ABOUT = {
  emp: 'Employees. dept_id links to dept.id, and manager_id points at another row in emp.',
  dept: 'Departments. Join with emp on emp.dept_id = dept.id.',
  customers: 'Customers of a small shop. Join with orders on customer_id.',
  orders: 'One row per order, with date, amount and status (DELIVERED, CANCELLED, RETURNED).',
  daily_sales: 'Total sales for each day. Good for running totals and moving averages.',
  staging: 'Raw rows from a source system, often with duplicates.',
  activity: 'One row per user action, with a date.',
  logins: 'One row per login, with user and date.',
  events: 'Event log with a user and a timestamp.',
  products: 'Product catalogue.',
  sales: 'Sales rows with product, date and amount.',
  src: 'Source table for a load or merge.',
  tgt: 'Target table the source is merged into.',
}

export const typeLabel = (t) => {
  if (/int/.test(t)) return 'number'
  if (/dec|num|double|float|real/.test(t)) return 'decimal'
  if (/timestamp/.test(t)) return 'date + time'
  if (/date/.test(t)) return 'date'
  if (/bool/.test(t)) return 'true / false'
  if (/char|text|string/.test(t)) return 'text'
  return t || 'any'
}
