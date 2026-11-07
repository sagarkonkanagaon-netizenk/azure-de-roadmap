import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { EditorState, Prec } from '@codemirror/state'
import { sql, PostgreSQL } from '@codemirror/lang-sql'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

// One Dark's comment grey, keyword violet and name coral fail WCAG contrast on the active line; lighten them.
const readableComments = Prec.highest(syntaxHighlighting(HighlightStyle.define([
  { tag: tags.comment, color: '#a3adbf', fontStyle: 'italic' },
  { tag: tags.keyword, color: '#d7a1e8' },
  { tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName], color: '#f2939a' },
])))

export default function CodeEditor({ value, onChange, lang = 'sql', onRun, minHeight = 180, label }) {
  const host = useRef(null)
  const view = useRef(null)
  const runRef = useRef(onRun)
  const changeRef = useRef(onChange)
  runRef.current = onRun
  changeRef.current = onChange

  useEffect(() => {
    const runKey = keymap.of([{ key: 'Mod-Enter', run: () => { runRef.current && runRef.current(); return true } }])
    view.current = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          runKey,
          basicSetup,
          lang === 'sql' ? sql({ dialect: PostgreSQL }) : python(),
          oneDark,
          readableComments,
          EditorView.lineWrapping,
          // Screen readers announce the editor by this name.
          EditorView.contentAttributes.of({ 'aria-label': label || (lang === 'sql' ? 'SQL editor' : 'Python editor') }),
          EditorView.theme({ '&': { minHeight: minHeight + 'px', backgroundColor: 'transparent' }, '.cm-gutters': { backgroundColor: 'transparent' }, '.cm-content': { padding: '10px 0' } }),
          EditorView.updateListener.of((u) => { if (u.docChanged) changeRef.current && changeRef.current(u.state.doc.toString()) }),
        ],
      }),
    })
    return () => view.current.destroy()
  }, [lang])

  useEffect(() => {
    const v = view.current
    if (v && value !== v.state.doc.toString()) {
      v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } })
    }
  }, [value])

  return <div className="editor-wrap" ref={host} />
}
