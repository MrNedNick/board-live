import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebsocketProvider } from 'y-websocket'
import {
  Awareness,
  applyAwarenessUpdate,
  encodeAwarenessUpdate,
  removeAwarenessStates,
} from 'y-protocols/awareness'
import { ensureColumns, type Author } from './model'

/**
 * Everything that moves a board between places:
 *
 * - IndexedDB keeps a copy on this device, so the board opens without a
 *   network and edits made offline are never lost;
 * - a BroadcastChannel syncs the tabs of this browser directly, with no
 *   server at all;
 * - a WebSocket to the relay in `server/` (when one is configured) syncs
 *   everyone else.
 *
 * All three carry Yjs updates, which merge in any order, so none of them needs
 * to know about the others.
 */

export interface Presence extends Author {
  /** Pointer position: x as a share of the board's width, y in pixels. */
  cursor?: { x: number; y: number } | null
  /** The card this person is dragging or editing. */
  holding?: string | null
}

export type Status =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'offline' }
  | { kind: 'tabs' }
  | { kind: 'server'; connected: boolean }

type Listener = () => void

/** Same-browser sync over BroadcastChannel, speaking a two-step handshake:
 * a new tab says hello with its state vector, the others answer with what it
 * is missing and their own vector, and it answers back in kind. */
class TabChannel {
  private channel: BroadcastChannel | null = null
  private doc: Y.Doc
  private awareness: Awareness
  private name: string

  constructor(name: string, doc: Y.Doc, awareness: Awareness) {
    this.name = name
    this.doc = doc
    this.awareness = awareness
  }

  private post(message: unknown) {
    this.channel?.postMessage(message)
  }

  private onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin !== this) this.post({ type: 'update', update })
  }

  private onAwarenessUpdate = ({ added, updated, removed }: Record<string, number[]>, origin: unknown) => {
    if (origin === this) return
    const changed = [...added!, ...updated!, ...removed!]
    this.post({ type: 'awareness', update: encodeAwarenessUpdate(this.awareness, changed) })
  }

  private onMessage = ({ data }: MessageEvent) => {
    if (data.type === 'hello' || data.type === 'welcome') {
      this.post({ type: 'update', update: Y.encodeStateAsUpdate(this.doc, data.vector) })
      if (data.type === 'hello') {
        this.post({ type: 'welcome', vector: Y.encodeStateVector(this.doc) })
        this.post({
          type: 'awareness',
          update: encodeAwarenessUpdate(this.awareness, [...this.awareness.getStates().keys()]),
        })
      }
    } else if (data.type === 'update') Y.applyUpdate(this.doc, data.update, this)
    else if (data.type === 'awareness') applyAwarenessUpdate(this.awareness, data.update, this)
  }

  get connected() {
    return !!this.channel
  }

  connect() {
    if (this.channel || typeof BroadcastChannel === 'undefined') return
    this.channel = new BroadcastChannel(this.name)
    this.channel.onmessage = this.onMessage
    this.doc.on('update', this.onDocUpdate)
    this.awareness.on('update', this.onAwarenessUpdate)
    this.post({ type: 'hello', vector: Y.encodeStateVector(this.doc) })
    this.post({ type: 'awareness', update: encodeAwarenessUpdate(this.awareness, [this.doc.clientID]) })
  }

  disconnect() {
    if (!this.channel) return
    // Tell the other tabs this person has left before going quiet.
    this.post({
      type: 'awareness',
      update: encodeAwarenessUpdate(this.awareness, [this.doc.clientID], new Map()),
    })
    this.doc.off('update', this.onDocUpdate)
    this.awareness.off('update', this.onAwarenessUpdate)
    this.channel.close()
    this.channel = null
    // Everyone seen through this channel is now out of reach.
    const others = [...this.awareness.getStates().keys()].filter((id) => id !== this.doc.clientID)
    removeAwarenessStates(this.awareness, others, this)
  }
}

export interface BoardConnectionOptions {
  room: string
  author: Author
  /** WebSocket relay; without one the board syncs between tabs only. */
  serverUrl?: string
}

export class BoardConnection {
  readonly doc = new Y.Doc()
  readonly awareness = new Awareness(this.doc)
  readonly room: string
  private persistence: IndexeddbPersistence | null = null
  private tabs: TabChannel
  private socket: WebsocketProvider | null = null
  private listeners = new Set<Listener>()
  private working = true
  private socketConnected = false
  status: Status = { kind: 'loading' }
  /** Bumped on every document update; deletions in Yjs do not move any
   * client's clock, so the state vector alone would miss them. */
  version = 0
  private changeListeners = new Set<Listener>()

  constructor({ room, author, serverUrl }: BoardConnectionOptions) {
    this.room = room
    this.doc.on('update', () => {
      this.version++
      for (const listener of this.changeListeners) listener()
    })
    this.awareness.setLocalState({ ...author, cursor: null, holding: null } satisfies Presence)
    this.tabs = new TabChannel(`board-live:${room}`, this.doc, this.awareness)
    if (serverUrl) {
      this.socket = new WebsocketProvider(serverUrl, room, this.doc, {
        awareness: this.awareness,
        connect: false,
        // The TabChannel already covers this browser.
        disableBc: true,
      })
      this.socket.on('status', ({ status }: { status: string }) => {
        this.socketConnected = status === 'connected'
        this.refresh()
      })
    }
  }

  /** Opens the local copy first, so the board shows what this device has
   * before any network is involved. */
  private opening: Promise<void> | null = null

  open() {
    // React's strict mode runs effects twice; the board opens once.
    if (this.opening && this.status.kind !== 'error') return this.opening
    this.opening = this.load()
    return this.opening
  }

  private async load() {
    this.status = { kind: 'loading' }
    this.emit()
    try {
      this.persistence = new IndexeddbPersistence(`board-live:${this.room}`, this.doc)
      await Promise.race([
        this.persistence.whenSynced,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
      ])
    } catch {
      this.persistence?.destroy()
      this.persistence = null
      this.status = {
        kind: 'error',
        message: 'This browser would not open the board’s local storage. Private windows and full disks can do that.',
      }
      this.emit()
      return
    }
    ensureColumns(this.doc)
    this.goOnline()
  }

  get online() {
    return this.working
  }

  goOnline() {
    this.working = true
    this.tabs.connect()
    this.socket?.connect()
    this.refresh()
  }

  /** Stops talking to anyone; edits keep landing in this tab and IndexedDB
   * and travel when the board goes back online. */
  goOffline() {
    this.working = false
    this.tabs.disconnect()
    this.socket?.disconnect()
    this.refresh()
  }

  setPresence(patch: Partial<Presence>) {
    const current = this.awareness.getLocalState() as Presence | null
    if (current) this.awareness.setLocalState({ ...current, ...patch })
  }

  private refresh() {
    if (this.status.kind === 'error' || !this.persistence) return
    this.status = !this.working
      ? { kind: 'offline' }
      : this.socket
        ? { kind: 'server', connected: this.socketConnected }
        : { kind: 'tabs' }
    this.emit()
  }

  onChange(listener: Listener) {
    this.changeListeners.add(listener)
    return () => {
      this.changeListeners.delete(listener)
    }
  }

  subscribe(listener: Listener) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit() {
    for (const listener of this.listeners) listener()
  }

  destroy() {
    removeAwarenessStates(this.awareness, [this.doc.clientID], 'destroy')
    this.tabs.disconnect()
    this.socket?.destroy()
    void this.persistence?.destroy()
    this.doc.destroy()
  }
}
