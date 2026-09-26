import type { Author } from './model'

const KEY = 'board-live-author'
const NAMES = ['Otter', 'Heron', 'Lynx', 'Marten', 'Puffin', 'Ibex', 'Kestrel', 'Badger', 'Wren', 'Fox', 'Orca', 'Hare']
// Dark enough for white initials and name tags to pass WCAG AA on every one.
const COLORS = ['#c62a2f', '#b8420a', '#8a6400', '#1d7a4a', '#0d7469', '#0062c4', '#6547c7', '#b0287b']

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]!

/** Who this browser is on the board. Kept in localStorage so a reload does
 * not turn you into someone else in everyone's history. */
export function loadAuthor(): Author {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Author | null
    if (saved?.name && COLORS.includes(saved.color)) return saved
    // An older palette colour: keep the name, move to a readable colour.
    if (saved?.name) {
      const author = { name: saved.name, color: pick(COLORS) }
      saveAuthor(author)
      return author
    }
  } catch {
    /* Storage blocked or corrupt: a fresh identity for this visit. */
  }
  const author = { name: `${pick(NAMES)} ${Math.floor(10 + Math.random() * 90)}`, color: pick(COLORS) }
  saveAuthor(author)
  return author
}

export function saveAuthor(author: Author) {
  try {
    localStorage.setItem(KEY, JSON.stringify(author))
  } catch {
    /* Identity still works for this visit. */
  }
}
