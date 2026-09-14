import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'board-live-theme'

function initialTheme(): Theme {
  let stored: Theme | null = null
  try {
    stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null
  } catch {
    /* storage blocked — fall back to the OS preference */
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  return stored ?? (prefersDark ? 'dark' : 'light')
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(initialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* nothing to do — the class is applied either way */
    }
  }, [theme])

  return (
    <button
      type="button"
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="flex size-9 items-center justify-center rounded-md border border-border text-text-muted transition-colors hover:text-text"
    >
      <span aria-hidden="true" className="text-sm">
        {theme === 'dark' ? '☀' : '☾'}
      </span>
    </button>
  )
}
