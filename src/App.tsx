import { useEffect, useState } from 'react'
import { Container } from './components/ui/container'
import { Header } from './components/header'
import { Footer } from './components/footer'
import { Board } from './components/board/board'
import { ConnectionStatus } from './components/board/connection-status'
import { HistoryPanel } from './components/board/history-panel'
import { Presence } from './components/board/presence'
import { Button } from './components/button/button'
import { Skeleton } from './components/skeleton/skeleton'
import { loadAuthor } from './board/identity'
import { revert } from './board/model'
import { useBoardConnection, useBoardData, usePeers } from './board/use-board'

const room = new URLSearchParams(location.search).get('board') || 'demo'
// Hosts tend to hand out the relay as an https:// address; the socket wants wss://.
const serverUrl = (import.meta.env.VITE_BOARD_SERVER as string | undefined)?.replace(/^http/, 'ws')

const POINTS = [
  {
    title: 'Edits merge on their own',
    body: 'Every change is a Yjs update. Two people typing into the same card keep both their words; nobody’s move overwrites anybody else’s.',
  },
  {
    title: 'Offline is not an error',
    body: 'The board lives in this browser too. Work without a connection and everything you did catches up the moment you are back.',
  },
  {
    title: 'You can see who is here',
    body: 'Faces in the header, named cursors over the board, and a coloured outline on any card someone else is holding.',
  },
]

function App() {
  const [author] = useState(loadAuthor)
  const connection = useBoardConnection(room, author, serverUrl)
  const { columns, cards, history } = useBoardData(connection)
  const peers = usePeers(connection)
  const status = connection.status
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* The address bar still has it. */
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface text-text">
      <Header>
        <Presence me={author} peers={peers} />
        <ConnectionStatus
          status={status}
          online={connection.online}
          onToggle={() => (connection.online ? connection.goOffline() : connection.goOnline())}
        />
      </Header>
      <main className="flex-1 py-10">
        <Container className="space-y-10">
          <section className="max-w-3xl space-y-4">
            <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              A task board that everyone edits at once
            </h1>
            {serverUrl ? (
              <p className="text-base text-text-muted">
                Open this page in a second tab, or send the link to someone, then move a card: it moves for
                everybody within a moment. Switch to offline, keep working, and your changes catch up when you
                come back.
              </p>
            ) : (
              <p className="text-base text-text-muted">
                <strong className="font-semibold text-text">Open this board in a second tab — and move cards.</strong>{' '}
                Both tabs change together, with faces and cursors for each. Switch one to offline, edit the same
                card in both, and watch them merge. This demo syncs the tabs of one browser; between devices
                the same board talks to a small sync server.
              </p>
            )}
            <div className="flex flex-wrap gap-3">
              <a
                href={location.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center rounded-md bg-accent px-4 text-sm font-medium text-on-accent shadow-sm transition-colors hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Open a second tab
              </a>
              {serverUrl && (
                <Button variant="outline" onClick={copyLink}>
                  {copied ? 'Link copied' : 'Copy link to this board'}
                </Button>
              )}
            </div>
          </section>

          {status.kind === 'loading' ? (
            <div aria-busy="true" aria-label="Loading the board" className="grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-3 rounded-lg border border-border bg-surface-raised p-3">
                  <Skeleton className="h-5 w-1/3" />
                  <Skeleton className="h-16" lines={2} />
                </div>
              ))}
            </div>
          ) : status.kind === 'error' ? (
            <div role="alert" className="rounded-lg border border-danger/40 bg-danger/5 p-6">
              <p className="font-semibold text-text">The board could not open</p>
              <p className="mt-1 text-sm text-text-muted">{status.message}</p>
              <Button className="mt-4" onClick={() => void connection.open()}>
                Try again
              </Button>
            </div>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
              <Board connection={connection} author={author} columns={columns} cards={cards} peers={peers} />
              <HistoryPanel entries={history} now={now} onRevert={(entry) => revert(connection.doc, entry, author)} />
            </div>
          )}

          <section aria-label="How it works" className="grid gap-6 border-t border-border pt-10 md:grid-cols-3">
            {POINTS.map((point) => (
              <div key={point.title} className="space-y-1.5">
                <h2 className="text-sm font-semibold text-text">{point.title}</h2>
                <p className="text-sm text-text-muted">{point.body}</p>
              </div>
            ))}
          </section>
        </Container>
      </main>
      <Footer />
    </div>
  )
}

export default App
