import { Container } from './ui/container'

const LINKS = [
  { label: 'GitHub', href: 'https://github.com/MrNedNick/board-live' },
  {
    label: 'README',
    href: 'https://github.com/MrNedNick/board-live#readme',
  },
]

export function Footer() {
  return (
    <footer className="border-t border-border py-10">
      <Container className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p className="text-xs text-text-muted">
          © {new Date().getFullYear()} board-live
        </p>
        <nav aria-label="Footer" className="flex gap-5">
          {LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-text-muted transition-colors hover:text-text"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </Container>
    </footer>
  )
}
