import { useSyncExternalStore } from 'react'

const KEY = 'z2h:progress:v1'
const empty = () => ({ chapters: {}, sql: {}, py: {}, spark: {}, scenarios: {}, drills: {}, checks: {}, cards: {}, days: [] })

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...empty(), ...JSON.parse(raw) }
  } catch (e) { /* storage unavailable */ }
  return empty()
}

let state = load()
const subs = new Set()

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)) } catch (e) { /* ignore */ }
  subs.forEach((f) => f())
}

function today() { return new Date().toISOString().slice(0, 10) }

function touchDay(s) {
  const d = today()
  return s.days.includes(d) ? s.days : [...s.days, d].slice(-400)
}

export function update(fn) {
  const next = { ...state }
  fn(next)
  next.days = touchDay(next)
  state = next
  save()
}

export function getProgress() { return state }

export function useProgress() {
  return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb) }, () => state, () => state)
}

export function setIn(area, key, value) {
  update((s) => { s[area] = { ...s[area], [key]: value } })
}

export function toggleIn(area, key) {
  update((s) => {
    const m = { ...s[area] }
    if (m[key]) delete m[key]; else m[key] = Date.now()
    s[area] = m
  })
}

export function streak(days) {
  const set = new Set(days)
  let n = 0
  const d = new Date()
  if (!set.has(d.toISOString().slice(0, 10))) d.setDate(d.getDate() - 1)
  while (set.has(d.toISOString().slice(0, 10))) { n++; d.setDate(d.getDate() - 1) }
  return n
}

export function exportProgress() { return JSON.stringify(state, null, 1) }
export function importProgress(text) {
  const data = JSON.parse(text)
  state = { ...empty(), ...data }
  save()
}
export function resetProgress() { state = empty(); save() }

export function subscribe(cb) { subs.add(cb); return () => subs.delete(cb) }

// Combine progress saved in the account with progress in this browser, keeping everything from both.
export function mergeProgress(other) {
  if (!other || typeof other !== 'object') return
  const next = { ...empty(), ...state }
  for (const k of Object.keys(empty())) {
    if (k === 'days') next.days = [...new Set([...(state.days || []), ...(other.days || [])])].sort().slice(-400)
    else if (other[k] && typeof other[k] === 'object') next[k] = { ...other[k], ...state[k] }
  }
  state = next
  save()
}
