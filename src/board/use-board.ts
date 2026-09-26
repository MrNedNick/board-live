import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { BoardConnection, type Presence } from './connection'
import { readCards, readColumns, readHistory, type Author } from './model'

/** Opens one board for the lifetime of the component and closes it — and
 * says goodbye to the other tabs — when the page goes away. */
export function useBoardConnection(room: string, author: Author, serverUrl?: string) {
  const [connection] = useState(() => new BoardConnection({ room, author, serverUrl }))
  useEffect(() => {
    void connection.open()
    const leave = () => connection.destroy()
    window.addEventListener('pagehide', leave)
    return () => {
      window.removeEventListener('pagehide', leave)
    }
  }, [connection])
  useSyncExternalStore(
    (listener) => connection.subscribe(listener),
    () => connection.status,
  )
  return connection
}

/** A snapshot of the board that changes identity only when the document does,
 * so React re-renders on every edit — local or remote — and never in between. */
export function useBoardData(connection: BoardConnection) {
  const version = useSyncExternalStore(
    (listener) => connection.onChange(listener),
    () => connection.version,
  )
  return useMemo(
    () => ({
      columns: readColumns(connection.doc),
      cards: readCards(connection.doc),
      history: readHistory(connection.doc),
      version,
    }),
    [connection, version],
  )
}

export interface Peer extends Presence {
  clientId: number
}

/** Everyone else on the board right now. */
export function usePeers(connection: BoardConnection): Peer[] {
  const cache = useRef<{ key: string; peers: Peer[] }>({ key: '', peers: [] })
  return useSyncExternalStore(
    (listener) => {
      connection.awareness.on('change', listener)
      return () => connection.awareness.off('change', listener)
    },
    () => {
      const peers: Peer[] = []
      connection.awareness.getStates().forEach((state, clientId) => {
        if (clientId !== connection.doc.clientID && state?.name) peers.push({ ...(state as Presence), clientId })
      })
      const key = JSON.stringify(peers)
      if (key !== cache.current.key) cache.current = { key, peers }
      return cache.current.peers
    },
  )
}
