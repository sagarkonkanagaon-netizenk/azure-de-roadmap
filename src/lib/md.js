import { Marked } from 'marked'
import hljs from 'highlight.js/lib/core'
import sql from 'highlight.js/lib/languages/sql'
import python from 'highlight.js/lib/languages/python'
import bash from 'highlight.js/lib/languages/bash'
import json from 'highlight.js/lib/languages/json'
import yaml from 'highlight.js/lib/languages/yaml'
import scala from 'highlight.js/lib/languages/scala'

hljs.registerLanguage('sql', sql)
hljs.registerLanguage('python', python)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('json', json)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('scala', scala)

export function slug(text) {
  return String(text).toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 64)
}

function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') }

export function highlight(code, lang) {
  if (lang && hljs.getLanguage(lang)) {
    try { return hljs.highlight(code, { language: lang }).value } catch (e) { /* fall through */ }
  }
  return esc(code)
}

const marked = new Marked({
  gfm: true,
  breaks: false,
  renderer: {
    code({ text, lang }) {
      const l = (lang || 'text').split(/\s/)[0]
      const runnable = l === 'sql' ? ' data-run="sql"' : ''
      return `<div class="codeblock" data-lang="${l}"${runnable}><div class="bar"><span>${l}</span><span><button data-copy>Copy</button>${l === 'sql' ? '<button data-try>Try in SQL lab</button>' : ''}</span></div><pre><code>${highlight(text, l)}</code></pre></div>`
    },
    heading({ tokens, depth }) {
      const html = this.parser.parseInline(tokens)
      const id = slug(html)
      return `<h${depth} id="${id}">${html}</h${depth}>`
    },
    table(token) {
      const head = token.header.map((c) => `<th>${this.parser.parseInline(c.tokens)}</th>`).join('')
      const body = token.rows.map((r) => `<tr>${r.map((c) => `<td>${this.parser.parseInline(c.tokens)}</td>`).join('')}</tr>`).join('')
      return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`
    },
    image({ href, text }) {
      const src = href.startsWith('./') ? import.meta.env.BASE_URL + href.slice(2) : href
      return `<img src="${src}" alt="${esc(text || 'diagram')}" loading="lazy" />`
    },
  },
})

export function renderMd(md) { return marked.parse(md || '') }

export function headings(md) {
  const out = []
  for (const line of (md || '').split('\n')) {
    const m = /^(#{2,4})\s+(.*)$/.exec(line)
    if (m) {
      const text = m[2].replace(/`/g, '').replace(/\*\*/g, '')
      out.push({ depth: m[1].length, text, id: slug(marked.parseInline(m[2])) })
    }
  }
  return out
}
