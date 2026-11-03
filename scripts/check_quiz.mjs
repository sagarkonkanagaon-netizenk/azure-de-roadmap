// Fails if the quiz gives answers away: correct option much longer than the rest, or duplicated ids/options.
import { QUIZ } from '../src/data/quiz.js'
let longest = 0, bad = [], ids = new Set()
for (const it of QUIZ) {
  if (ids.has(it.id)) bad.push('duplicate id ' + it.id); ids.add(it.id)
  if (it.a.length !== 4 || new Set(it.a).size !== 4) bad.push('needs 4 distinct options: ' + it.id)
  const L = it.a.map((x) => x.length), max = Math.max(...L)
  if (L[0] === max) longest++
  const others = L.slice(1).reduce((s, x) => s + x, 0) / 3
  if (L[0] > others * 1.35 && L[0] - others > 12) bad.push(`correct option much longer in ${it.id} (${L[0]} vs avg ${Math.round(others)})`)
}
const share = longest / QUIZ.length
console.log(`${QUIZ.length} questions; correct option is the longest in ${longest} (${Math.round(share * 100)}%)`)
if (share > 0.4) bad.push('correct option is the longest too often')
if (bad.length) { console.error(bad.join('\n')); process.exit(1) }
