// Builds a handbook's JSON from content-src/<book>/*.md.
// Each file: "# Title" on line 1, then markdown. ```practice blocks list "sql 31" (SQL lab problem) or
// "py 4" (Python lab) lines and become link boxes. Reading minutes count prose at 200 words a minute
// and code at 60 lines a minute... roughly what a learner spends typing it out.
import fs from 'fs'
import path from 'path'

const book = process.argv[2] || 'sql'
const dir = `content-src/${book}`
const sqlQ = JSON.parse(fs.readFileSync('src/content/sql-questions.json', 'utf8')).questions
const pyQ = JSON.parse(fs.readFileSync('src/content/py-questions.json', 'utf8'))
const pyList = pyQ.questions || pyQ
const slugify = (t) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

function practice(body) {
  const links = body.trim().split('\n').map((ln) => {
    const [kind, n] = ln.trim().split(/\s+/)
    if (kind === 'sql') { const q = sqlQ.find((x) => x.n === Number(n)); if (!q) throw new Error('no sql ' + n); return `<a href="#/practice/sql/${n}"><span>SQL ${n}</span>${esc(q.title)}</a>` }
    if (kind === 'py') { const q = pyList.find((x) => x.n === Number(n)); if (!q) throw new Error('no py ' + n); return `<a href="#/practice/python/${n}"><span>Python ${n}</span>${esc(q.title)}</a>` }
    if (kind === 'page') { const [, to, ...label] = ln.trim().split(/\s+/); return `<a href="#${to}">${esc(label.join(' '))}</a>` }
    throw new Error('bad practice line: ' + ln)
  })
  return `<div class="practice-box"><b>Practise this</b>${links.join('')}</div>`
}

const files = fs.readdirSync(dir).filter((f) => /^\d+-.*\.md$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b))
const chapters = files.map((f) => {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8')
  const num = parseInt(f)
  const title = raw.split('\n')[0].replace(/^#\s+/, '').trim()
  let md = raw.split('\n').slice(1).join('\n').trim() + '\n'
  md = md.replace(/```practice\n([\s\S]*?)```/g, (_, b) => practice(b))
  const code = (md.match(/```[\s\S]*?```/g) || []).join('\n')
  const prose = md.replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>/g, ' ')
  const minutes = Math.max(2, Math.round(prose.split(/\s+/).filter(Boolean).length / 200 + code.split('\n').length / 60))
  return { num, slug: `${num}-${slugify(title)}`, title, minutes, md }
})
fs.writeFileSync(`src/content/books/${book}.json`, JSON.stringify(chapters))
const idxPath = 'src/content/books-index.json'
const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'))
const b = idx.find((x) => x.slug === book)
b.chapters = chapters.map(({ num, slug, title, minutes }) => ({ num, slug, title, minutes }))
fs.writeFileSync(idxPath, JSON.stringify(idx))
const total = chapters.reduce((a, c) => a + c.minutes, 0)
console.log(`${book}: ${chapters.length} chapters, ${total} min, ${chapters.reduce((a, c) => a + c.md.split(/\s+/).length, 0)} words`)
