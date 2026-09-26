// A small y-websocket relay: one Yjs document per room, kept in memory, with
// the sync and awareness protocols the browser provider speaks. It has no say
// over the board's contents — edits are CRDT updates that merge in any order —
// it only passes them on and holds the latest state for whoever joins next.
//
//   PORT=1234 node server/server.mjs
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync'
import * as awarenessProtocol from 'y-protocols/awareness'
import * as encoding from 'lib0/encoding'
import * as decoding from 'lib0/decoding'

const MESSAGE_SYNC = 0
const MESSAGE_AWARENESS = 1
const PING_INTERVAL = 30_000
const port = Number(process.env.PORT || 1234)

/** @type {Map<string, { doc: Y.Doc, awareness: awarenessProtocol.Awareness, conns: Map<import('ws').WebSocket, Set<number>> }>} */
const rooms = new Map()

function room(name) {
  let entry = rooms.get(name)
  if (entry) return entry
  const doc = new Y.Doc()
  const awareness = new awarenessProtocol.Awareness(doc)
  awareness.setLocalState(null)
  entry = { doc, awareness, conns: new Map() }
  rooms.set(name, entry)

  doc.on('update', (update, origin) => {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_SYNC)
    syncProtocol.writeUpdate(encoder, update)
    broadcast(entry, encoding.toUint8Array(encoder), origin)
  })
  awareness.on('update', ({ added, updated, removed }, origin) => {
    const changed = [...added, ...updated, ...removed]
    const ids = entry.conns.get(origin)
    if (ids) {
      for (const id of added) ids.add(id)
      for (const id of removed) ids.delete(id)
    }
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS)
    encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awareness, changed))
    broadcast(entry, encoding.toUint8Array(encoder))
  })
  return entry
}

function broadcast(entry, message, except) {
  for (const conn of entry.conns.keys()) if (conn !== except) send(conn, message)
}

function send(conn, message) {
  if (conn.readyState === conn.OPEN) conn.send(message, (error) => error && conn.close())
}

function join(conn, name) {
  const entry = room(name)
  entry.conns.set(conn, new Set())
  conn.binaryType = 'arraybuffer'

  conn.on('message', (data) => {
    const decoder = decoding.createDecoder(new Uint8Array(data))
    const encoder = encoding.createEncoder()
    const type = decoding.readVarUint(decoder)
    if (type === MESSAGE_SYNC) {
      encoding.writeVarUint(encoder, MESSAGE_SYNC)
      syncProtocol.readSyncMessage(decoder, encoder, entry.doc, conn)
      if (encoding.length(encoder) > 1) send(conn, encoding.toUint8Array(encoder))
    } else if (type === MESSAGE_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(entry.awareness, decoding.readVarUint8Array(decoder), conn)
    }
  })

  let alive = true
  conn.on('pong', () => (alive = true))
  const ping = setInterval(() => {
    if (!alive) return conn.terminate()
    alive = false
    conn.ping()
  }, PING_INTERVAL)

  conn.on('close', () => {
    clearInterval(ping)
    const ids = entry.conns.get(conn)
    entry.conns.delete(conn)
    // Whoever was on this connection leaves the board at once.
    if (ids?.size) awarenessProtocol.removeAwarenessStates(entry.awareness, [...ids], null)
  })

  // Start the handshake: our state vector, and who is already here.
  const step1 = encoding.createEncoder()
  encoding.writeVarUint(step1, MESSAGE_SYNC)
  syncProtocol.writeSyncStep1(step1, entry.doc)
  send(conn, encoding.toUint8Array(step1))
  const states = entry.awareness.getStates()
  if (states.size) {
    const hello = encoding.createEncoder()
    encoding.writeVarUint(hello, MESSAGE_AWARENESS)
    encoding.writeVarUint8Array(hello, awarenessProtocol.encodeAwarenessUpdate(entry.awareness, [...states.keys()]))
    send(conn, encoding.toUint8Array(hello))
  }
}

// Plain HTTP answers health checks; the WebSocket upgrade shares the port.
const http = createServer((_, response) => {
  response.writeHead(200, { 'content-type': 'text/plain' })
  response.end(`board-live relay · ${rooms.size} open boards\n`)
})
const server = new WebSocketServer({ server: http })
http.listen(port)
server.on('connection', (conn, request) => {
  const name = decodeURIComponent((request.url || '/').slice(1).split('?')[0] || 'default')
  join(conn, name)
})
console.log(`board-live relay on ws://localhost:${port}`)
