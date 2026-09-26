import { afterEach, beforeAll, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { BoardConnection } from '../../../board/connection'
import { ensureColumns, readCards, readColumns } from '../../../board/model'
import { Board } from '../board'

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(cleanup)

function renderBoard() {
  const author = { name: 'Anna', color: '#e5484d' }
  const connection = new BoardConnection({ room: `ui-${Math.random()}`, author })
  ensureColumns(connection.doc)
  const view = () => (
    <Board
      connection={connection}
      author={author}
      columns={readColumns(connection.doc)}
      cards={readCards(connection.doc)}
      peers={[]}
    />
  )
  const utils = render(view())
  connection.onChange(() => utils.rerender(view()))
  return connection
}

it('adds a card, moves it with the keyboard buttons and deletes it', () => {
  const connection = renderBoard()
  expect(screen.getByText('No cards yet')).toBeTruthy()

  fireEvent.change(screen.getByLabelText('Add a card to To do', { selector: 'input' }), {
    target: { value: 'Ship the board' },
  })
  fireEvent.submit(screen.getByLabelText('Add a card to To do', { selector: 'input' }).closest('form')!)
  expect(within(screen.getByRole('region', { name: 'To do' })).getByDisplayValue('Ship the board')).toBeTruthy()
  expect(screen.queryByText('No cards yet')).toBeNull()

  fireEvent.click(screen.getByRole('button', { name: 'Move “Ship the board” to In progress' }))
  expect(readCards(connection.doc)[0]!.columnId).toBe('doing')

  fireEvent.click(screen.getByRole('button', { name: 'Delete “Ship the board”' }))
  expect(readCards(connection.doc)).toHaveLength(0)
  connection.destroy()
})
