import type { Status } from '../../board/connection'
import { Badge } from '../badge/badge'
import { Button } from '../button/button'

const COPY: Record<Status['kind'], { tone: 'success' | 'warning' | 'neutral' | 'danger'; label: string }> = {
  loading: { tone: 'neutral', label: 'Opening…' },
  error: { tone: 'danger', label: 'Not available' },
  offline: { tone: 'warning', label: 'Offline — changes stay here' },
  tabs: { tone: 'success', label: 'Live across tabs' },
  server: { tone: 'success', label: 'Live' },
}

/** Where edits are going right now, and the switch that lets anyone try the
 * offline story without pulling a cable. */
export function ConnectionStatus({
  status,
  online,
  onToggle,
}: {
  status: Status
  online: boolean
  onToggle: () => void
}) {
  const copy =
    status.kind === 'server' && !status.connected
      ? { tone: 'warning' as const, label: 'Reconnecting…' }
      : COPY[status.kind]
  return (
    <div className="flex items-center gap-2">
      <Badge tone={copy.tone} role="status">
        <span aria-hidden="true" className="mr-1.5 inline-block size-1.5 rounded-full bg-current" />
        {copy.label}
      </Badge>
      {(status.kind === 'offline' || status.kind === 'tabs' || status.kind === 'server') && (
        <Button size="sm" variant="ghost" onClick={onToggle} aria-pressed={!online}>
          {online ? 'Work offline' : 'Go back online'}
        </Button>
      )}
    </div>
  )
}
