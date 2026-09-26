import { useRef, useState, type DragEvent, type PointerEvent, type ReactNode } from 'react'
import type { BoardConnection } from '../../board/connection'
import {
  addCard,
  deleteCard,
  logRename,
  moveCard,
  orderAt,
  renameColumn,
  typeTitle,
  type Author,
  type Card,
  type Column,
} from '../../board/model'
import type { Peer } from '../../board/use-board'
import { cn } from '../../lib/cn'
import { Button } from '../button/button'
import { EmptyState } from '../empty-state/empty-state'
import { Input } from '../input/input'
import { CardItem } from './card-item'
import { Cursors } from './cursors'

export interface BoardProps {
  connection: BoardConnection
  author: Author
  columns: Column[]
  cards: Card[]
  peers: Peer[]
}

export function Board({ connection, author, columns, cards, peers }: BoardProps) {
  const doc = connection.doc
  const surface = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ columnId: string; index: number } | null>(null)

  const trackPointer = (event: PointerEvent) => {
    const box = surface.current?.getBoundingClientRect()
    if (!box) return
    const cursor = { x: (event.clientX - box.left) / box.width, y: event.clientY - box.top }
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => connection.setPresence({ cursor }))
  }

  const dropIndex = (event: DragEvent, columnId: string) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[data-card-id]')].filter(
      (el) => el.dataset.cardId !== dragging,
    )
    const index = items.findIndex((el) => {
      const box = el.getBoundingClientRect()
      return event.clientY < box.top + box.height / 2
    })
    return { columnId, index: index === -1 ? items.length : index }
  }

  const drop = (target: { columnId: string; index: number }, id: string) => {
    const rest = cards.filter((card) => card.columnId === target.columnId && card.id !== id)
    moveCard(doc, id, target.columnId, orderAt(rest, target.index), author)
  }

  const endDrag = () => {
    setDragging(null)
    setDropTarget(null)
    connection.setPresence({ holding: null })
  }

  return (
    <div className="space-y-4">
      {cards.length === 0 && (
        <EmptyState
          title="No cards yet"
          description="Add the first one below. Then open this page in a second tab and watch it appear there too."
          action={
            <Button size="sm" onClick={() => document.getElementById(`add-${columns[0]?.id}`)?.focus()}>
              Add the first card
            </Button>
          }
        />
      )}
      <div
        ref={surface}
        onPointerMove={trackPointer}
        onPointerLeave={() => connection.setPresence({ cursor: null })}
        className="relative"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {columns.map((column) => {
            const list = cards.filter((card) => card.columnId === column.id)
            const target = dropTarget?.columnId === column.id ? dropTarget.index : -1
            return (
              <section
                key={column.id}
                aria-label={column.title}
                className={cn(
                  'flex min-w-0 flex-col rounded-lg border border-border bg-surface-raised p-3 transition-colors',
                  target !== -1 && 'border-accent',
                )}
              >
                <header className="mb-3 flex items-center gap-2">
                  <label className="sr-only" htmlFor={`column-${column.id}`}>
                    Column name
                  </label>
                  <input
                    id={`column-${column.id}`}
                    key={column.title}
                    defaultValue={column.title}
                    onBlur={(event) => renameColumn(doc, column.id, event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.currentTarget.blur()
                    }}
                    className="min-w-0 flex-1 rounded-sm bg-transparent px-1 text-sm font-semibold text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                  <span className="text-xs text-text-muted tabular-nums" aria-label={`${list.length} cards`}>
                    {list.length}
                  </span>
                </header>
                <ul
                  className="flex min-h-16 flex-1 flex-col gap-2"
                  onDragOver={(event) => {
                    if (!dragging) return
                    event.preventDefault()
                    setDropTarget(dropIndex(event, column.id))
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropTarget(null)
                  }}
                  onDrop={(event) => {
                    event.preventDefault()
                    const id = event.dataTransfer.getData('text/plain') || dragging
                    if (id) drop(dropIndex(event, column.id), id)
                    endDrag()
                  }}
                >
                  {list.map((card, i) => (
                    <Slot key={card.id} marker={target === i}>
                      <CardItem
                        card={card}
                        columns={columns}
                        holders={peers.filter((peer) => peer.holding === card.id)}
                        onType={(title) => typeTitle(doc, card.id, title)}
                        onEditStart={() => connection.setPresence({ holding: card.id })}
                        onEditEnd={(before) => {
                          logRename(doc, card.id, before, author)
                          connection.setPresence({ holding: null })
                        }}
                        onMove={(columnId) => {
                          const rest = cards.filter((c) => c.columnId === columnId)
                          moveCard(doc, card.id, columnId, orderAt(rest, rest.length), author)
                        }}
                        onDelete={() => deleteCard(doc, card.id, author)}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('text/plain', card.id)
                          event.dataTransfer.effectAllowed = 'move'
                          setDragging(card.id)
                          connection.setPresence({ holding: card.id })
                        }}
                        onDragEnd={endDrag}
                      />
                    </Slot>
                  ))}
                  {target === list.filter((c) => c.id !== dragging).length && <DropMarker />}
                </ul>
                <AddCard
                  id={`add-${column.id}`}
                  label={`Add a card to ${column.title}`}
                  onAdd={(title) => addCard(doc, column.id, title, author)}
                />
              </section>
            )
          })}
        </div>
        <Cursors peers={peers} surface={surface} />
      </div>
    </div>
  )
}

function Slot({ marker, children }: { marker: boolean; children: ReactNode }) {
  return (
    <>
      {marker && <DropMarker />}
      {children}
    </>
  )
}

function DropMarker() {
  return <li aria-hidden="true" className="h-1 rounded-full bg-accent" />
}

function AddCard({ id, label, onAdd }: { id: string; label: string; onAdd: (title: string) => void }) {
  const [title, setTitle] = useState('')
  return (
    <form
      className="mt-3 flex gap-2"
      onSubmit={(event) => {
        event.preventDefault()
        if (!title.trim()) return
        onAdd(title)
        setTitle('')
      }}
    >
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <Input
        id={id}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Add a card…"
        className="h-9 min-w-0 flex-1 text-sm"
      />
      <Button type="submit" size="sm" variant="outline" aria-label={label} disabled={!title.trim()}>
        Add
      </Button>
    </form>
  )
}
