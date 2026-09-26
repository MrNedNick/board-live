import { useLayoutEffect, useRef, type DragEvent, type ReactNode } from 'react'
import type { Card, Column } from '../../board/model'
import type { Peer } from '../../board/use-board'
import { cn } from '../../lib/cn'

export interface CardItemProps {
  card: Card
  columns: Column[]
  /** Other people currently dragging or editing this card. */
  holders: Peer[]
  onType: (title: string) => void
  onEditStart: () => void
  onEditEnd: (before: string) => void
  onMove: (columnId: string) => void
  onDelete: () => void
  onDragStart: (event: DragEvent) => void
  onDragEnd: () => void
}

/**
 * The title is an uncontrolled input on purpose: when someone else edits the
 * same card, the new text is written in here by hand so the caret stays where
 * the reader left it instead of jumping to the end on every remote keystroke.
 */
export function CardItem({
  card,
  columns,
  holders,
  onType,
  onEditStart,
  onEditEnd,
  onMove,
  onDelete,
  onDragStart,
  onDragEnd,
}: CardItemProps) {
  const input = useRef<HTMLInputElement>(null)
  const before = useRef(card.title)

  useLayoutEffect(() => {
    const el = input.current
    if (!el || el.value === card.title) return
    if (document.activeElement !== el) {
      el.value = card.title
      return
    }
    const caret = el.selectionStart ?? el.value.length
    let prefix = 0
    while (prefix < caret && el.value[prefix] === card.title[prefix]) prefix++
    const shifted = prefix < caret ? caret + (card.title.length - el.value.length) : caret
    el.value = card.title
    el.setSelectionRange(shifted, shifted)
  }, [card.title])

  const index = columns.findIndex((c) => c.id === card.columnId)
  const left = columns[index - 1]
  const right = columns[index + 1]
  const holder = holders[0]

  return (
    <li
      data-card-id={card.id}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative rounded-md border border-border bg-surface p-2 shadow-card',
        'cursor-grab active:cursor-grabbing',
      )}
      style={holder ? { boxShadow: `0 0 0 2px ${holder.color}` } : undefined}
    >
      {holder && (
        <span
          className="absolute -top-2.5 right-2 rounded-sm px-1.5 text-[11px] leading-5 font-medium text-white"
          style={{ background: holder.color }}
        >
          {holder.name}
        </span>
      )}
      <label className="sr-only" htmlFor={`card-${card.id}`}>
        Card title
      </label>
      <input
        id={`card-${card.id}`}
        ref={input}
        defaultValue={card.title}
        placeholder="Untitled card"
        onChange={(event) => onType(event.target.value)}
        onFocus={() => {
          before.current = card.title
          onEditStart()
        }}
        onBlur={() => onEditEnd(before.current)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === 'Escape') event.currentTarget.blur()
        }}
        className={cn(
          'w-full rounded-sm bg-transparent px-1.5 py-1 text-sm text-text',
          'outline-none focus-visible:ring-2 focus-visible:ring-accent',
        )}
      />
      <div className="mt-1 flex items-center gap-1 px-1 text-xs text-text-muted">
        <span className="mr-auto truncate">{card.createdBy}</span>
        <IconButton label={`Move “${card.title || 'Untitled card'}” to ${left?.title}`} disabled={!left} onClick={() => left && onMove(left.id)}>
          <path d="M10 4 6 8l4 4" />
        </IconButton>
        <IconButton label={`Move “${card.title || 'Untitled card'}” to ${right?.title}`} disabled={!right} onClick={() => right && onMove(right.id)}>
          <path d="m6 4 4 4-4 4" />
        </IconButton>
        <IconButton label={`Delete “${card.title || 'Untitled card'}”`} onClick={onDelete} danger>
          <path d="M3.5 4.5h9M6.5 4.5V3h3v1.5M5 4.5l.5 8h5l.5-8" />
        </IconButton>
      </div>
    </li>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex size-7 items-center justify-center rounded-sm transition-colors',
        'hover:bg-surface-raised focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-30',
        danger ? 'hover:text-danger' : 'hover:text-text',
      )}
    >
      <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {children}
      </svg>
    </button>
  )
}
