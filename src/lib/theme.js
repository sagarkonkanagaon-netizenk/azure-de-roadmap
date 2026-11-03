import { useEffect, useState } from 'react'

const KEY = 'z2h:theme'
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem(KEY) || 'system' } catch (e) { return 'system' }
  })
  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try { localStorage.setItem(KEY, theme) } catch (e) { /* ignore */ }
  }, [theme])
  const isDark = theme === 'dark' || (theme === 'system' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches)
  return { theme, isDark, toggle: () => setTheme(isDark ? 'light' : 'dark') }
}
