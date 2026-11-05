// Builds a handbook's JSON from content-src/<book>/*.md.
// Each file: "# Title" on line 1, then markdown. ```practice blocks list "sql 31" (SQL lab problem) or
// "py 4" (Python lab) lines and become link boxes. Reading minutes count prose at 200 words a minute
// and code at 60 lines a minute... roughly what a learner spends typing it out.
import fs from 'fs'
import path from 'path'

const book = process.argv[2] || 'sql'
const dir = `content-src/${book}`
if (!fs.existsSync(dir)) throw new Error(`${dir} not found: this handbook isn't built from markdown`)
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

// Pro deep dives live in content-src/<book>/pro/. Only their preview is in the repo: the text up to a
// ```locked block, whose lines are the section titles shown behind the lock.
const mdFiles = (d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /^\d+-.*\.md$/.test(f)).sort((a, b) => parseInt(a) - parseInt(b)) : [])
const read = (d, f, pro) => {
  const raw = fs.readFileSync(path.join(d, f), 'utf8')
  const num = parseInt(f)
  const title = raw.split('\n')[0].replace(/^#\s+/, '').replace(/^Deep dive:\s*/i, '').trim().replace(/^./, (ch) => ch.toUpperCase())
  let md = raw.split('\n').slice(1).join('\n').trim() + '\n'
  let locked
  md = md.replace(/```locked\n([\s\S]*?)```\n?/, (_, b) => { locked = b.trim().split('\n').map((x) => x.trim()).filter(Boolean); return '' })
  if (pro && !locked) throw new Error(`${f}: a Pro deep dive needs a \`\`\`locked block`)
  if (!pro && locked) throw new Error(`${f}: \`\`\`locked is only for Pro deep dives`)
  md = md.replace(/```practice\n([\s\S]*?)```/g, (_, b) => practice(b))
  const code = (md.match(/```[\s\S]*?```/g) || []).join('\n')
  const prose = md.replace(/```[\s\S]*?```/g, '').replace(/<[^>]+>/g, ' ')
  const minutes = Math.max(2, Math.round(prose.split(/\s+/).filter(Boolean).length / 200 + code.split('\n').length / 60))
  return pro ? { num, slug: `pro-${num}-${slugify(title)}`, title, minutes, md, pro: true, locked } : { num, slug: `${num}-${slugify(title)}`, title, minutes, md }
}
const chapters = mdFiles(dir).map((f) => read(dir, f, false))
const deep = mdFiles(`${dir}/pro`).map((f) => read(`${dir}/pro`, f, true))
fs.writeFileSync(`src/content/books/${book}.json`, JSON.stringify([...chapters, ...deep]))
const idxPath = 'src/content/books-index.json'
const idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'))
const b = idx.find((x) => x.slug === book)
if (!b) throw new Error(`register "${book}" in books-index.json first`)
b.chapters = chapters.map(({ num, slug, title, minutes }) => ({ num, slug, title, minutes }))
b.minutes = chapters.reduce((a, c) => a + c.minutes, 0)
if (deep.length) b.deep = deep.map(({ num, slug, title, locked }) => ({ num, slug, title, sections: locked.length }))
else delete b.deep
fs.writeFileSync(idxPath, JSON.stringify(idx))
const total = chapters.reduce((a, c) => a + c.minutes, 0)
console.log(`${book}: ${chapters.length} chapters + ${deep.length} Pro deep dives, ${total} min, ${chapters.reduce((a, c) => a + c.md.split(/\s+/).length, 0)} words`)
