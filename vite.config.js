import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// The home page shows how many problems exist. Count them at build time, so the page
// doesn't download 130 KB of question files just to read two numbers.
const count = (f) => JSON.parse(readFileSync(new URL(f, import.meta.url))).questions.length
const COUNTS = { sql: count('./src/content/sql-questions.json'), py: count('./src/content/py-questions.json') }

export default defineConfig({
  base: './',
  plugins: [react()],
  define: { __QUESTION_COUNTS__: JSON.stringify(COUNTS) },
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          editor: ['codemirror', '@codemirror/lang-sql', '@codemirror/lang-python', '@codemirror/theme-one-dark'],
          md: ['marked', 'highlight.js/lib/core'],
        },
      },
    },
  },
  worker: { format: 'es' },
})
