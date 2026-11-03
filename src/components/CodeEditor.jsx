import { useEffect, useRef } from 'react'
import { EditorView, basicSetup } from 'codemirror'
import { keymap } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { sql, PostgreSQL } from '@codemirror/lang-sql'
import { python } from '@codemirror/lang-python'
import { oneDark } from '@codemirror/theme-one-dark'

export default function CodeEditor({ value, onChange, lang = 'sql', onRun, minHeight = 180 }) {
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
          EditorView.lineWrapping,
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
