import type { HistoryEntry } from '../../board/model'
import { Button } from '../button/button'

const minute = 60_000

function ago(at: number, now: number) {
  const diff = Math.max(0, now - at)
  if (diff < minute) return 'just now'
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} min ago`
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))} h ago`
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

function describe(entry: HistoryEntry) {
  const title = `“${entry.title || 'Untitled card'}”`
  switch (entry.kind) {
    case 'create':
      return `added ${title} to ${entry.to}`
    case 'rename':
      return `renamed “${entry.previous?.title || 'Untitled card'}” to ${title}`
    case 'move':
      return `moved ${title} from ${entry.from} to ${entry.to}`
    case 'delete':
      return `deleted ${title} from ${entry.from}`
    case 'restore':
      return `restored ${title} in ${entry.to}`
  }
}

/** Who did what, newest first. Anything with a previous state can be put
 * back, and the revert is itself an entry everyone sees. */
export function HistoryPanel({
  entries,
  now,
  onRevert,
}: {
  entries: HistoryEntry[]
  now: number
  onRevert: (entry: HistoryEntry) => void
}) {
  return (
    <section aria-labelledby="history-title" className="rounded-lg border border-border bg-surface p-4">
      <h2 id="history-title" className="text-sm font-semibold text-text">
        History
      </h2>
      {entries.length === 0 ? (
        <p className="mt-2 text-sm text-text-muted">Every change to the board shows up here, with who made it.</p>
      ) : (
        <ol className="mt-3 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <li key={entry.id} className="flex gap-2 text-sm">
              <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: entry.color }} />
              <div className="min-w-0 flex-1">
                <p className="text-text">
                  <span className="font-medium">{entry.by}</span> {describe(entry)}
                </p>
                <p className="flex items-center gap-2 text-xs text-text-muted">
                  <time dateTime={new Date(entry.at).toISOString()}>{ago(entry.at, now)}</time>
                  {entry.previous && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 text-xs"
                      onClick={() => onRevert(entry)}
                      aria-label={`Revert: ${entry.by} ${describe(entry)}`}
                    >
                      Revert
                    </Button>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
