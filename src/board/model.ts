import * as Y from 'yjs'

/**
 * The board lives in one Yjs document, and every operation below is a plain
 * function over it. Nothing here knows about React, the network or storage:
 * whoever holds the document — a tab, a test, the server — gets the same
 * behaviour, and concurrent edits merge the same way everywhere.
 *
 *   columns  Y.Map<id, Y.Map { title, order }>
 *   cards    Y.Map<id, Y.Map { columnId, order, title: Y.Text, createdBy, createdAt, updatedAt }>
 *   history  Y.Array<HistoryEntry>
 */

export interface Column {
  id: string
  title: string
  order: number
}

export interface Card {
  id: string
  columnId: string
  order: number
  title: string
  createdBy: string
  createdAt: number
  updatedAt: number
}

export interface Author {
  name: string
  color: string
}

export interface CardState {
  title: string
  columnId: string
  order: number
}

export type HistoryKind = 'create' | 'rename' | 'move' | 'delete' | 'restore'

export interface HistoryEntry {
  id: string
  at: number
  by: string
  color: string
  kind: HistoryKind
  cardId: string
  title: string
  /** Column names at the time, so the feed still reads right after a rename. */
  from?: string
  to?: string
  /** The card as it was before this change — what "revert" puts back. */
  previous?: CardState
}

export const HISTORY_LIMIT = 200

/** Columns every new board starts with. Their ids are fixed, so two people
 * opening an empty board at the same moment write the same keys and end up
 * with three columns, not six. */
export const DEFAULT_COLUMNS: Column[] = [
  { id: 'todo', title: 'To do', order: 1 },
  { id: 'doing', title: 'In progress', order: 2 },
  { id: 'done', title: 'Done', order: 3 },
]

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

const columnsOf = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>('columns')
const cardsOf = (doc: Y.Doc) => doc.getMap<Y.Map<unknown>>('cards')
export const historyOf = (doc: Y.Doc) => doc.getArray<HistoryEntry>('history')

export function ensureColumns(doc: Y.Doc) {
  const columns = columnsOf(doc)
  if (columns.size) return
  doc.transact(() => {
    for (const column of DEFAULT_COLUMNS) {
      const map = new Y.Map<unknown>()
      map.set('title', column.title)
      map.set('order', column.order)
      columns.set(column.id, map)
    }
  })
}

export function readColumns(doc: Y.Doc): Column[] {
  const out: Column[] = []
  columnsOf(doc).forEach((map, id) => {
    out.push({ id, title: String(map.get('title') ?? ''), order: Number(map.get('order') ?? 0) })
  })
  return out.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

export function readCards(doc: Y.Doc): Card[] {
  const out: Card[] = []
  cardsOf(doc).forEach((map, id) => {
    const title = map.get('title')
    out.push({
      id,
      columnId: String(map.get('columnId') ?? ''),
      order: Number(map.get('order') ?? 0),
      title: title instanceof Y.Text ? title.toString() : '',
      createdBy: String(map.get('createdBy') ?? ''),
      createdAt: Number(map.get('createdAt') ?? 0),
      updatedAt: Number(map.get('updatedAt') ?? 0),
    })
  })
  return out.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))
}

export function readHistory(doc: Y.Doc): HistoryEntry[] {
  return historyOf(doc).toArray().slice().reverse()
}

export function cardText(doc: Y.Doc, id: string) {
  const text = cardsOf(doc).get(id)?.get('title')
  return text instanceof Y.Text ? text : null
}

function columnTitle(doc: Y.Doc, id: string) {
  return String(columnsOf(doc).get(id)?.get('title') ?? id)
}

function stateOf(doc: Y.Doc, id: string): CardState | null {
  const map = cardsOf(doc).get(id)
  if (!map) return null
  return {
    title: String(map.get('title') ?? ''),
    columnId: String(map.get('columnId')),
    order: Number(map.get('order')),
  }
}

function log(doc: Y.Doc, author: Author, entry: Omit<HistoryEntry, 'id' | 'at' | 'by' | 'color'>) {
  const history = historyOf(doc)
  history.push([{ id: newId(), at: Date.now(), by: author.name, color: author.color, ...entry }])
  if (history.length > HISTORY_LIMIT) history.delete(0, history.length - HISTORY_LIMIT)
}

/** An order value that lands a card after everything in its column. */
function orderAtEnd(doc: Y.Doc, columnId: string) {
  const orders = readCards(doc)
    .filter((card) => card.columnId === columnId)
    .map((card) => card.order)
  return orders.length ? Math.max(...orders) + 1 : 1
}

/** An order value between the card now at `index` and the one before it, so a
 * move never has to renumber anyone else's cards. */
export function orderAt(cards: Card[], index: number) {
  const before = cards[index - 1]?.order
  const after = cards[index]?.order
  if (before === undefined && after === undefined) return 1
  if (before === undefined) return after! - 1
  if (after === undefined) return before + 1
  return (before + after) / 2
}

function writeCard(doc: Y.Doc, id: string, state: CardState, author: Author, createdAt = Date.now()) {
  const map = new Y.Map<unknown>()
  map.set('columnId', state.columnId)
  map.set('order', state.order)
  map.set('title', new Y.Text(state.title))
  map.set('createdBy', author.name)
  map.set('createdAt', createdAt)
  map.set('updatedAt', Date.now())
  cardsOf(doc).set(id, map)
}

export function addCard(doc: Y.Doc, columnId: string, title: string, author: Author) {
  const id = newId()
  const clean = title.trim()
  doc.transact(() => {
    writeCard(doc, id, { columnId, order: orderAtEnd(doc, columnId), title: clean }, author)
    log(doc, author, { kind: 'create', cardId: id, title: clean, to: columnTitle(doc, columnId) })
  })
  return id
}

/**
 * Turns the text into `next` with the smallest insert and delete, instead of
 * replacing it: two people typing into the same card then both keep their
 * words, because each change only touches the characters it actually edits.
 */
export function applyTextChange(text: Y.Text, next: string) {
  const current = text.toString()
  if (current === next) return
  let start = 0
  while (start < current.length && start < next.length && current[start] === next[start]) start++
  let endCurrent = current.length
  let endNext = next.length
  while (endCurrent > start && endNext > start && current[endCurrent - 1] === next[endNext - 1]) {
    endCurrent--
    endNext--
  }
  text.doc!.transact(() => {
    if (endCurrent > start) text.delete(start, endCurrent - start)
    if (endNext > start) text.insert(start, next.slice(start, endNext))
  })
}

/** Keystrokes go straight into the shared text; the feed records one rename
 * per editing session, when the field is left. */
export function typeTitle(doc: Y.Doc, id: string, next: string) {
  const text = cardText(doc, id)
  if (!text) return
  doc.transact(() => {
    applyTextChange(text, next)
    cardsOf(doc).get(id)!.set('updatedAt', Date.now())
  })
}

export function logRename(doc: Y.Doc, id: string, before: string, author: Author) {
  const now = stateOf(doc, id)
  if (!now || now.title === before) return
  log(doc, author, { kind: 'rename', cardId: id, title: now.title, previous: { ...now, title: before } })
}

export function moveCard(doc: Y.Doc, id: string, columnId: string, order: number, author: Author) {
  const previous = stateOf(doc, id)
  if (!previous || (previous.columnId === columnId && previous.order === order)) return
  doc.transact(() => {
    const map = cardsOf(doc).get(id)!
    map.set('columnId', columnId)
    map.set('order', order)
    map.set('updatedAt', Date.now())
    if (previous.columnId !== columnId)
      log(doc, author, {
        kind: 'move',
        cardId: id,
        title: previous.title,
        from: columnTitle(doc, previous.columnId),
        to: columnTitle(doc, columnId),
        previous,
      })
  })
}

export function deleteCard(doc: Y.Doc, id: string, author: Author) {
  const previous = stateOf(doc, id)
  if (!previous) return
  doc.transact(() => {
    cardsOf(doc).delete(id)
    log(doc, author, {
      kind: 'delete',
      cardId: id,
      title: previous.title,
      from: columnTitle(doc, previous.columnId),
      previous,
    })
  })
}

/** Puts a card back the way it was before `entry` — its old title, its old
 * column, or back on the board after a delete. */
export function revert(doc: Y.Doc, entry: HistoryEntry, author: Author) {
  const previous = entry.previous
  if (!previous) return
  doc.transact(() => {
    const map = cardsOf(doc).get(entry.cardId)
    // A deleted column would leave the card nowhere; the first column will do.
    const columnId = columnsOf(doc).has(previous.columnId) ? previous.columnId : readColumns(doc)[0]!.id
    if (!map) writeCard(doc, entry.cardId, { ...previous, columnId }, author)
    else {
      const text = map.get('title')
      if (text instanceof Y.Text) applyTextChange(text, previous.title)
      map.set('columnId', columnId)
      map.set('order', previous.order)
      map.set('updatedAt', Date.now())
    }
    log(doc, author, { kind: 'restore', cardId: entry.cardId, title: previous.title, to: columnTitle(doc, columnId) })
  })
}

export function renameColumn(doc: Y.Doc, id: string, title: string) {
  const clean = title.trim()
  if (clean) columnsOf(doc).get(id)?.set('title', clean)
}

export function addColumn(doc: Y.Doc, title: string) {
  const id = newId()
  const order = Math.max(0, ...readColumns(doc).map((c) => c.order)) + 1
  doc.transact(() => {
    const map = new Y.Map<unknown>()
    map.set('title', title.trim() || 'New column')
    map.set('order', order)
    columnsOf(doc).set(id, map)
  })
  return id
}
