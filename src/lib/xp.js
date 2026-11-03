// XP, levels and badges are derived from saved progress, so they never drift from what you did.
import { streak } from './progress.js'

export const POINTS = { chapter: 10, sql: 20, py: 20, spark: 10, scenario: 15, drill: 50, project: 100, check: 5, card: 5, daily: 30 }

export const LEVELS = [
  { xp: 0, name: 'Curious', icon: '🌱' },
  { xp: 100, name: 'Data Intern', icon: '🧪' },
  { xp: 300, name: 'Junior Data Engineer', icon: '🔧' },
  { xp: 700, name: 'Data Engineer', icon: '⚙️' },
  { xp: 1300, name: 'Senior Data Engineer', icon: '🚀' },
  { xp: 2200, name: 'Staff Data Engineer', icon: '🛰️' },
  { xp: 3500, name: 'Data Hero', icon: '🦸' },
]

export function tally(p) {
  const n = {
    chapter: Object.keys(p.chapters).length,
    sql: Object.values(p.sql).filter((v) => v === 'solved').length,
    py: Object.values(p.py).filter((v) => v === 'solved').length,
    spark: Object.values(p.spark).filter((v) => v === 'known').length,
    scenario: Object.keys(p.scenarios).length,
    drill: Object.keys(p.drills).length,
    project: Object.keys(p.checks).filter((k) => /^proj\d+$/.test(k)).length,
    check: Object.keys(p.checks).filter((k) => /^v2w\d+:/.test(k)).length,
    card: Object.values(p.cards).filter((c) => c.box >= 3).length,
    daily: Object.entries(p.checks).filter(([k, v]) => k.startsWith('daily:') && v && v.solved).length,
  }
  const quiz = Object.entries(p.checks).filter(([k]) => k.startsWith('quiz:')).reduce((a, [, v]) => a + Math.round(Number(v) / 2), 0)
  const xp = Object.entries(n).reduce((a, [k, v]) => a + v * POINTS[k], 0) + quiz
  return { n, quiz, xp }
}

export function levelOf(xp) {
  let i = 0
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1].xp) i++
  const cur = LEVELS[i]
  const next = LEVELS[i + 1]
  return { i, ...cur, next, pct: next ? Math.round((100 * (xp - cur.xp)) / (next.xp - cur.xp)) : 100 }
}

export const BADGES = [
  { id: 'first-query', icon: '🗄️', name: 'First query', desc: 'Solve your first SQL question', test: (t) => t.n.sql >= 1 },
  { id: 'sql-25', icon: '🪟', name: 'Window wizard', desc: 'Solve 25 SQL questions', test: (t) => t.n.sql >= 25 },
  { id: 'sql-all', icon: '👑', name: 'SQL royalty', desc: 'Solve 70 SQL questions', test: (t) => t.n.sql >= 70 },
  { id: 'pythonista', icon: '🐍', name: 'Pythonista', desc: 'Solve 10 Python questions', test: (t) => t.n.py >= 10 },
  { id: 'reader', icon: '📘', name: 'Bookworm', desc: 'Read 20 chapters', test: (t) => t.n.chapter >= 20 },
  { id: 'firefighter', icon: '🚒', name: 'Firefighter', desc: 'Resolve your first incident', test: (t) => t.n.drill >= 1 },
  { id: 'on-call', icon: '📟', name: 'On-call hero', desc: 'Resolve every incident drill', test: (t) => t.n.drill >= 5 },
  { id: 'storyteller', icon: '🎤', name: 'Storyteller', desc: 'Practise 10 scenario answers out loud', test: (t) => t.n.scenario >= 10 },
  { id: 'builder', icon: '🏗️', name: 'Builder', desc: 'Ship a portfolio project', test: (t) => t.n.project >= 1 },
  { id: 'streak-7', icon: '🔥', name: 'Week on fire', desc: 'Learn 7 days in a row', test: (t, p) => streak(p.days) >= 7 },
  { id: 'daily-1', icon: '📅', name: 'Daily habit', desc: 'Solve your first daily SQL challenge', test: (t) => t.n.daily >= 1 },
  { id: 'daily-7', icon: '🗓️', name: 'Seven dailies', desc: 'Solve 7 daily SQL challenges', test: (t) => t.n.daily >= 7 },
  { id: 'quiz-80', icon: '🎯', name: 'Sharp shooter', desc: 'Score 80% or more in a quiz round', test: (t, p) => Object.entries(p.checks).some(([k, v]) => k.startsWith('quiz:') && v >= 80) },
]

export function badgesOf(p) {
  const t = tally(p)
  return BADGES.map((b) => ({ ...b, earned: !!b.test(t, p) }))
}
