import { Container } from './components/ui/container'
import { Header } from './components/header'
import { Footer } from './components/footer'

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-surface text-text">
      <Header />
      <main className="flex-1 py-16">
        <Container className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-text sm:text-4xl">
            board-live
          </h1>
          <p className="max-w-2xl text-base text-text-muted">
            A shared task board that stays in sync across everyone looking at
            it: cards move live, edits merge without a server-side referee,
            and going offline never loses a change.
          </p>
        </Container>
      </main>
      <Footer />
    </div>
  )
}

export default App
