import { useEffect, useState, type RefObject } from 'react'
import type { Peer } from '../../board/use-board'

/** Other people's pointers over the board. Positions arrive as a share of the
 * board's width, so a cursor lands on the same column on any screen size. */
export function Cursors({ peers, surface }: { peers: Peer[]; surface: RefObject<HTMLDivElement | null> }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = surface.current
    if (!el) return
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    return () => observer.disconnect()
  }, [surface])

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {peers.map((peer) =>
        peer.cursor ? (
          <div
            key={peer.clientId}
            className="absolute top-0 left-0 transition-transform duration-75 ease-linear motion-reduce:transition-none"
            style={{ transform: `translate(${peer.cursor.x * width}px, ${peer.cursor.y}px)` }}
          >
            <svg width="16" height="18" viewBox="0 0 16 18">
              <path d="M1 1l13 7-6 1.5L5 16z" fill={peer.color} stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
            <span
              className="ml-3 -mt-1 block rounded-sm px-1.5 text-[11px] leading-5 font-medium whitespace-nowrap text-white"
              style={{ background: peer.color }}
            >
              {peer.name}
            </span>
          </div>
        ) : null,
      )}
    </div>
  )
}
