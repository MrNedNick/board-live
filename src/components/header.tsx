import type { ReactNode } from 'react'
import { Container } from './ui/container'
import { ThemeToggle } from './theme-toggle'

export function Header({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur">
      <Container className="flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-2">
        <span className="text-base font-semibold tracking-tight text-text">board-live</span>
        <div className="flex flex-wrap items-center gap-3">
          {children}
          <ThemeToggle />
        </div>
      </Container>
    </header>
  )
}
