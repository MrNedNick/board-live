import { Container } from './ui/container'
import { ThemeToggle } from './theme-toggle'

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-6">
        <span className="text-base font-semibold tracking-tight text-text">
          board-live
        </span>
        <ThemeToggle />
      </Container>
    </header>
  )
}
