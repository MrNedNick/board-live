import type { Author } from '../../board/model'
import type { Peer } from '../../board/use-board'
import { Avatar } from '../avatar/avatar'

/** You first, then everyone else on the board, each in their cursor colour. */
export function Presence({ me, peers }: { me: Author; peers: Peer[] }) {
  const people = [{ ...me, clientId: -1, you: true }, ...peers.map((p) => ({ ...p, you: false }))]
  const shown = people.slice(0, 5)
  const summary =
    peers.length === 0 ? 'Only you are here' : `You and ${peers.length} ${peers.length === 1 ? 'other person' : 'others'} here`
  return (
    <div className="flex items-center gap-2">
      <ul aria-label={summary} className="flex -space-x-2">
        {shown.map((person) => (
          <li key={person.clientId} title={person.you ? `${person.name} (you)` : person.name}>
            <Avatar
              name={person.name}
              size="sm"
              className="ring-2 ring-surface"
              style={{ background: person.color, color: 'white' }}
            />
          </li>
        ))}
        {people.length > shown.length && (
          <li>
            <Avatar name={`+ ${people.length - shown.length}`} size="sm" className="ring-2 ring-surface" />
          </li>
        )}
      </ul>
      <span className="hidden text-xs text-text-muted lg:inline">{summary}</span>
    </div>
  )
}
