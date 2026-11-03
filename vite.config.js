import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
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
