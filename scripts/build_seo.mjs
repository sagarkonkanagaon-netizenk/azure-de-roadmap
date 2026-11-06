// Search pages for Google and Bing. Runs after `vite build` and writes plain HTML into dist/:
//   /guide/<book>/<chapter>/              every handbook chapter (intro + first section; chapter 1 in full)
//   /sql-interview-questions/<slug>/      every SQL Lab problem (statement; first 5 with answers)
//   /python-interview-questions/<slug>/   every Python Lab problem (statement; first 3 with answers)
//   /glossary/<term>/                     "What is X?" pages from src/data/glossary.js
//   + a hub page for each section, sitemap.xml and robots.txt
// The app itself uses hash routes (/#/learn/...), which search engines treat as one page.
// These pages are real URLs with real text, and every one links into the app, where signing in opens the rest.
// Rule agreed with Sagar (2026-11-06): public preview, login to use.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { marked } from 'marked'
import { GLOSSARY } from '../src/data/glossary.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIST = join(ROOT, 'dist')
const SITE = 'https://datadhaba.in'
const TODAY = new Date().toISOString().slice(0, 10)
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const slugify = (s) => String(s).toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70).replace(/-+$/, '')
const plain = (md) => md.replace(/```[\s\S]*?```/g, ' ').replace(/[#*_`>|[\]()-]/g, ' ').replace(/\s+/g, ' ').trim()
const clip = (s, n = 155) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n - 1)) + '…')

const pages = [] // { path, priority }

function page({ path, title, description, h1, crumbs, body, cta, jsonld }) {
  const url = `${SITE}${path}`
  const crumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${SITE}${c.path}` })),
  }
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Data Dhaba">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/img/data-dhaba-banner.png">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(crumbLd)}</script>
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld)}</script>` : ''}
<style>
:root{--bg:#faf8f9;--card:#fff;--line:#ebe3e8;--text:#16142b;--muted:#6b6884;--primary:#c8155a;--accent:#08706a;--code:#1a1420}
@media (prefers-color-scheme:dark){:root{--bg:#120f1a;--card:#1b1726;--line:#2d2638;--text:#f1edf6;--muted:#a9a3b8;--primary:#ff4f8b;--accent:#3fd0c7;--code:#0b0910}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:17px/1.65 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--primary)}header,main,footer{max-width:760px;margin:0 auto;padding:0 16px}
header{display:flex;align-items:center;justify-content:space-between;padding-top:18px;padding-bottom:18px}
.brand{font-weight:800;text-decoration:none;color:var(--text);font-size:19px}.brand span{color:var(--primary)}
nav.crumbs{font-size:14px;color:var(--muted);margin:8px 0 4px}nav.crumbs a{color:var(--muted)}
h1{font-size:clamp(26px,5vw,36px);line-height:1.2;margin:8px 0 12px}h2{margin-top:32px;font-size:22px}
.lead{color:var(--muted);font-size:18px}
pre{background:var(--code);color:#f4eef8;padding:14px 16px;border-radius:10px;overflow-x:auto;font-size:14.5px;line-height:1.5}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.92em}
table{border-collapse:collapse;display:block;overflow-x:auto;max-width:100%}td,th{border:1px solid var(--line);padding:6px 10px;text-align:left}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;margin:24px 0}
.cta{background:linear-gradient(135deg,rgba(200,21,90,.10),rgba(8,112,106,.10));border-color:transparent}
.btn{display:inline-block;background:var(--primary);color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:10px}
.btns{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px}.btn.ghost{background:transparent;color:var(--primary);border:1px solid var(--primary)}
ul.list{padding-left:20px}ul.list li{margin:6px 0}.tag{font-size:13px;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:.04em}
footer{color:var(--muted);font-size:14px;padding-top:24px;padding-bottom:40px;border-top:1px solid var(--line);margin-top:40px}
</style>
</head>
<body>
<header><a class="brand" href="/">Data <span>Dhaba</span></a><a href="/#/account">Sign in</a></header>
<main>
<nav class="crumbs">${crumbs.map((c, i) => (i < crumbs.length - 1 ? `<a href="${c.path}">${esc(c.name)}</a>` : esc(c.name))).join(' › ')}</nav>
<h1>${esc(h1 || title)}</h1>
${body}
${cta ? `<div class="card cta"><strong>${esc(cta.title)}</strong><p>${esc(cta.text)}</p><div class="btns"><a class="btn" href="${cta.href}">${esc(cta.button)}</a><a class="btn ghost" href="/#/account">Create an account</a></div></div>` : ''}
</main>
<footer>Data Dhaba · On your highway to get hired. Learn data engineering by doing it, right in your browser. · <a href="/guide/">Handbooks</a> · <a href="/sql-interview-questions/">SQL questions</a> · <a href="/python-interview-questions/">Python questions</a> · <a href="/glossary/">Glossary</a></footer>
<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token": "1648f240a4c44ca0b4feeda8efcf7e12"}'></script>
</body>
</html>
`
  const out = join(DIST, path, 'index.html')
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, html)
  pages.push({ path, priority: path.split('/').filter(Boolean).length <= 1 ? '0.8' : '0.6' })
}

// ── handbooks ────────────────────────────────────────────────────────────
// Preview = the intro plus the first "## " section. Chapter 1 of every book is open in the app, so it is shown in full.
function preview(md, full) {
  if (full) return { md, cut: false }
  const heads = [...md.matchAll(/^## .*/gm)].map((m) => m.index)
  if (heads.length < 2) return { md: md.slice(0, Math.max(800, Math.floor(md.length / 3))), cut: true }
  return { md: md.slice(0, heads[1]), cut: true }
}

const books = read('src/content/books-index.json')
const hubItems = []
for (const b of books) {
  const chapters = read(`src/content/books/${b.slug}.json`)
  const items = []
  for (const ch of chapters) {
    const path = `/guide/${b.slug}/${ch.slug}/`
    const full = String(ch.slug).startsWith('1-')
    const { md, cut } = preview(ch.md, full)
    const desc = clip(plain(ch.md))
    page({
      path, title: `${ch.title} · ${b.title} | Data Dhaba`, h1: ch.title, description: desc,
      crumbs: [{ name: 'Home', path: '/' }, { name: 'Handbooks', path: '/guide/' }, { name: b.title, path: `/guide/${b.slug}/` }, { name: ch.title, path }],
      body: `<p class="tag">${esc(b.title)} · chapter ${esc(ch.num)} · ${esc(ch.minutes)} min read</p>${marked.parse(md)}`,
      cta: cut
        ? { title: 'Keep reading this chapter', text: 'The rest of this chapter, its runnable examples, the quiz and the "In the interview" section open after you sign in with email or Google.', href: `/#/learn/${b.slug}/${ch.slug}`, button: 'Continue in Data Dhaba' }
        : { title: 'Run these examples yourself', text: 'Open the chapter in Data Dhaba to run every example in your browser and take the quiz.', href: `/#/learn/${b.slug}/${ch.slug}`, button: 'Open the chapter' },
      jsonld: { '@context': 'https://schema.org', '@type': 'LearningResource', name: ch.title, description: desc, url: `${SITE}${path}`,
        learningResourceType: 'Chapter', educationalLevel: 'Beginner to intermediate', inLanguage: 'en-IN', isAccessibleForFree: full,
        isPartOf: { '@type': 'Course', name: b.title, provider: { '@type': 'Organization', name: 'Data Dhaba', sameAs: SITE } } },
    })
    items.push(`<li><a href="${path}">${esc(ch.num)}. ${esc(ch.title)}</a></li>`)
  }
  page({
    path: `/guide/${b.slug}/`, title: `${b.title}: free chapters, examples and interview angles | Data Dhaba`.replace('free ', ''), h1: b.title,
    description: clip(`${b.title}: ${b.subtitle || ''}. ${chapters.length} short chapters with runnable examples, quizzes and interview questions.`),
    crumbs: [{ name: 'Home', path: '/' }, { name: 'Handbooks', path: '/guide/' }, { name: b.title, path: `/guide/${b.slug}/` }],
    body: `<p class="lead">${esc(b.subtitle || '')}</p><ul class="list">${items.join('')}</ul>`,
    cta: { title: 'Learn it by doing it', text: 'Every example runs in your browser. Sign in to save your progress.', href: `/#/learn/${b.slug}`, button: 'Open the handbook' },
  })
  hubItems.push(`<li><a href="/guide/${b.slug}/">${esc(b.title)}</a>: ${chapters.length} chapters</li>`)
}
page({
  path: '/guide/', title: 'Data engineering handbooks: SQL, Python, PySpark, Databricks, Streaming | Data Dhaba', h1: 'Data engineering handbooks',
  description: 'Five handbooks for data engineers: SQL, Python, PySpark, Databricks and Streaming. Short chapters with runnable examples and interview questions.',
  crumbs: [{ name: 'Home', path: '/' }, { name: 'Handbooks', path: '/guide/' }],
  body: `<p class="lead">Short chapters you finish in minutes, with examples you run in the browser.</p><ul class="list">${hubItems.join('')}</ul>`,
  cta: { title: 'Start the 24-week path', text: 'A day-by-day plan through every handbook, with weekly builds.', href: '/#/path', button: 'See the path' },
})

// ── interview questions ──────────────────────────────────────────────────
function questions({ file, base, label, appBase, openUpTo, lang }) {
  const qs = read(file).questions
  const used = new Set()
  const bySection = {}
  for (const q of qs) {
    let slug = slugify(q.title) || `question-${q.n}`
    while (used.has(slug)) slug += `-${q.n}`
    used.add(slug)
    const path = `${base}${slug}/`
    const open = Number(q.n) <= openUpTo
    const desc = clip(`${label} #${q.n}: ${q.title}. ${q.section}. Practise it on a real engine in your browser, with the answer explained.`)
    const body = [
      `<p class="tag">${esc(label)} · ${esc(q.section)} · #${esc(q.n)}</p>`,
      q.given ? `<h2>Given</h2><pre><code>${esc(q.given)}</code></pre>` : '',
      `<h2>The question</h2><p>${esc(q.title)}</p>`,
      open && q.answer ? `<h2>Answer</h2><pre><code class="language-${lang}">${esc(q.answer)}</code></pre>` : '',
      open && q.note ? `<h2>Why it works</h2><p>${esc(q.note)}</p>` : '',
    ].join('')
    page({
      path, title: `${q.title} | ${label} | Data Dhaba`, h1: q.title, description: desc,
      crumbs: [{ name: 'Home', path: '/' }, { name: label, path: base }, { name: `#${q.n}`, path }],
      body,
      cta: open
        ? { title: 'Try it yourself', text: 'Run your own answer against real data and see if it passes.', href: `${appBase}${q.n}`, button: 'Solve it in Data Dhaba' }
        : { title: 'Solve it on a real engine', text: 'Write your answer in the browser and it is checked instantly. The model answer and the explanation open after you sign in.', href: `${appBase}${q.n}`, button: 'Solve it in Data Dhaba' },
      jsonld: { '@context': 'https://schema.org', '@type': 'LearningResource', name: q.title, description: desc, url: `${SITE}${path}`,
        learningResourceType: 'Practice problem', inLanguage: 'en-IN', teaches: q.section, provider: { '@type': 'Organization', name: 'Data Dhaba', sameAs: SITE } },
    })
    ;(bySection[q.section] ||= []).push(`<li><a href="${path}">${esc(q.title)}</a></li>`)
  }
  page({
    path: base, title: `${qs.length} ${label} with answers, practised in your browser | Data Dhaba`, h1: `${qs.length} ${label}`,
    description: clip(`${qs.length} ${label.toLowerCase()} asked in data engineering and analytics interviews, grouped by topic. Solve each on a real engine in your browser.`),
    crumbs: [{ name: 'Home', path: '/' }, { name: label, path: base }],
    body: `<p class="lead">Grouped by topic, from basics to the questions that decide offers.</p>` +
      Object.entries(bySection).map(([s, li]) => `<h2>${esc(s)}</h2><ul class="list">${li.join('')}</ul>`).join(''),
    cta: { title: 'Practise all of them', text: 'Every answer is checked the moment you press Run.', href: appBase.replace(/\/$/, ''), button: 'Open the lab' },
  })
}
questions({ file: 'src/content/sql-questions.json', base: '/sql-interview-questions/', label: 'SQL interview questions', appBase: '/#/practice/sql/', openUpTo: 5, lang: 'sql' })
questions({ file: 'src/content/py-questions.json', base: '/python-interview-questions/', label: 'Python and PySpark interview questions', appBase: '/#/practice/python/', openUpTo: 3, lang: 'python' })

// ── glossary ─────────────────────────────────────────────────────────────
for (const g of GLOSSARY) {
  const path = `/glossary/${g.slug}/`
  const name = g.term.replace(/ \(.*\)$/, '')
  page({
    path, title: `What is ${name}? Explained simply | Data Dhaba`, h1: `What is ${g.term}?`, description: clip(g.short),
    crumbs: [{ name: 'Home', path: '/' }, { name: 'Glossary', path: '/glossary/' }, { name: g.term, path }],
    body: `<p class="lead">${esc(g.short)}</p><p>${esc(g.body)}</p><h2>In the interview</h2><p>${esc(g.interview)}</p>`,
    cta: { title: `Learn ${name} by doing it`, text: 'Short chapters, runnable examples and interview practice in your browser.', href: `/#${g.learn}`, button: 'Start learning' },
    jsonld: { '@context': 'https://schema.org', '@type': 'DefinedTerm', name: g.term, description: g.short, url: `${SITE}${path}`,
      inDefinedTermSet: { '@type': 'DefinedTermSet', name: 'Data Dhaba data engineering glossary', url: `${SITE}/glossary/` } },
  })
}
page({
  path: '/glossary/', title: 'Data engineering and analytics glossary: terms explained simply | Data Dhaba', h1: 'Data engineering glossary',
  description: 'Plain-English definitions of data engineering and analytics terms: ETL, data lake, lakehouse, SCD Type 2, Spark, Kafka, dbt, Airflow and more.',
  crumbs: [{ name: 'Home', path: '/' }, { name: 'Glossary', path: '/glossary/' }],
  body: `<ul class="list">${[...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term)).map((g) => `<li><a href="/glossary/${g.slug}/">${esc(g.term)}</a>: ${esc(g.short)}</li>`).join('')}</ul>`,
  cta: { title: 'From words to work', text: 'Each term links to the chapter that teaches it, with examples you can run.', href: '/#/learn', button: 'Open the handbooks' },
})

// ── sitemap + robots ─────────────────────────────────────────────────────
const urls = [{ path: '/', priority: '1.0' }, ...pages]
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${SITE}${u.path}</loc><lastmod>${TODAY}</lastmod><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`)
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *
Allow: /
Sitemap: ${SITE}/sitemap.xml
`)
console.log(`seo: ${pages.length} pages + sitemap.xml (${urls.length} URLs) + robots.txt`)
