import { afterEach, describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { BoardConnection } from '../connection'
import {
  addCard,
  applyTextChange,
  cardText,
  deleteCard,
  ensureColumns,
  moveCard,
  orderAt,
  readCards,
  readColumns,
  readHistory,
  revert,
  typeTitle,
} from '../model'

const anna = { name: 'Anna', color: '#e5484d' }
const ben = { name: 'Ben', color: '#0090ff' }
const open: BoardConnection[] = []

/** A "tab": a connection that skips IndexedDB and joins the room over the
 * BroadcastChannel, exactly as a second browser tab does. */
function tab(room: string, author = anna) {
  const connection = new BoardConnection({ room, author })
  ensureColumns(connection.doc)
  connection.goOnline()
  open.push(connection)
  return connection
}

const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((r) => setTimeout(r, 10))
  expect(check()).toBe(true)
}
const titles = (doc: Y.Doc) => readCards(doc).map((c) => c.title)

afterEach(() => {
  while (open.length) open.pop()!.destroy()
})

describe('two tabs on one board', () => {
  it('see each other’s cards and moves without a reload', async () => {
    const room = `r-${Math.random()}`
    const a = tab(room, anna)
    const b = tab(room, ben)
    const id = addCard(a.doc, 'todo', 'Write tests', anna)
    await until(() => titles(b.doc).includes('Write tests'))

    moveCard(b.doc, id, 'done', 1, ben)
    await until(() => readCards(a.doc)[0]?.columnId === 'done')
    expect(readColumns(a.doc).map((c) => c.title)).toEqual(['To do', 'In progress', 'Done'])
  })

  it('keeps both edits when one tab worked offline on the same card', async () => {
    const room = `r-${Math.random()}`
    const a = tab(room, anna)
    const b = tab(room, ben)
    const id = addCard(a.doc, 'todo', 'Launch', anna)
    await until(() => titles(b.doc).includes('Launch'))

    a.goOffline()
    typeTitle(a.doc, id, 'Launch on Friday')
    typeTitle(b.doc, id, 'Plan: Launch')
    moveCard(b.doc, id, 'doing', 1, ben)
    expect(titles(a.doc)).toEqual(['Launch on Friday'])

    a.goOnline()
    await until(() => titles(a.doc)[0] === titles(b.doc)[0])
    expect(titles(a.doc)).toEqual(['Plan: Launch on Friday'])
    expect(readCards(a.doc)[0]!.columnId).toBe('doing')
  })

  it('tells the other tab who is here, and that they left', async () => {
    const room = `r-${Math.random()}`
    const a = tab(room, anna)
    const b = tab(room, ben)
    const names = () => [...a.awareness.getStates().values()].map((s) => s.name).sort()
    await until(() => names().join() === 'Anna,Ben')
    b.goOffline()
    await until(() => names().join() === 'Anna')
  })
})

describe('board operations', () => {
  const board = () => {
    const doc = new Y.Doc()
    ensureColumns(doc)
    return doc
  }

  it('creates the default columns once, even when two people start together', () => {
    const one = board()
    const two = board()
    Y.applyUpdate(one, Y.encodeStateAsUpdate(two))
    expect(readColumns(one)).toHaveLength(3)
  })

  it('places a moved card between its new neighbours', () => {
    const doc = board()
    addCard(doc, 'todo', 'First', anna)
    addCard(doc, 'todo', 'Third', anna)
    const id = addCard(doc, 'doing', 'Second', anna)
    const todo = readCards(doc).filter((c) => c.columnId === 'todo')
    moveCard(doc, id, 'todo', orderAt(todo, 1), anna)
    expect(titles(doc)).toEqual(['First', 'Second', 'Third'])
  })

  it('edits text with the smallest change, so concurrent typing merges', () => {
    const one = board()
    const id = addCard(one, 'todo', 'Ship it', anna)
    const two = new Y.Doc()
    Y.applyUpdate(two, Y.encodeStateAsUpdate(one))
    applyTextChange(cardText(one, id)!, 'Ship it today')
    applyTextChange(cardText(two, id)!, 'Please ship it')
    Y.applyUpdate(one, Y.encodeStateAsUpdate(two))
    Y.applyUpdate(two, Y.encodeStateAsUpdate(one))
    expect(cardText(one, id)!.toString()).toBe(cardText(two, id)!.toString())
    expect(cardText(one, id)!.toString()).toBe('Please ship it today')
  })

  it('records who did what and puts a deleted card back', () => {
    const doc = board()
    const id = addCard(doc, 'todo', 'Keep me', anna)
    moveCard(doc, id, 'done', 5, ben)
    deleteCard(doc, id, ben)
    expect(readCards(doc)).toHaveLength(0)

    const [deletion, move, creation] = readHistory(doc)
    expect(creation).toMatchObject({ kind: 'create', by: 'Anna', to: 'To do' })
    expect(move).toMatchObject({ kind: 'move', by: 'Ben', from: 'To do', to: 'Done' })
    revert(doc, deletion!, anna)
    expect(readCards(doc)).toMatchObject([{ id, title: 'Keep me', columnId: 'done' }])
    expect(readHistory(doc)[0]).toMatchObject({ kind: 'restore', by: 'Anna' })
  })
})
