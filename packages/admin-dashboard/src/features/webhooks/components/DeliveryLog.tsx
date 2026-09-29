import type { DeliveryLogEntry, DeliveryStatus } from '../webhooks-api'
import { eventLabel } from '../webhook-events'
import { formatAbsolute } from '@/lib/format'
import { cn } from '@/lib/utils'

const STATUS: Record<DeliveryStatus, { label: string; className: string }> = {
  SUCCESS: { label: 'Delivered', className: 'bg-status-published-bg text-status-published-fg' },
  FAILED: { label: 'Failed', className: 'bg-status-unread-bg text-status-unread-fg' },
  RETRYING: { label: 'Retrying', className: 'bg-status-draft-bg text-status-draft-fg' },
  PENDING: { label: 'Pending', className: 'bg-status-draft-bg text-status-draft-fg' },
}

export function DeliveryLog({ logs }: { logs: DeliveryLogEntry[] }) {
  if (logs.length === 0) return <p className="text-sm text-muted-foreground">No deliveries yet. Send a test to try it.</p>
  return (
    <div className="overflow-x-auto">
      <table aria-label="Delivery log" className="w-full text-left text-sm">
        <thead className="text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th scope="col" className="py-1 pr-3 font-medium">Time</th>
            <th scope="col" className="py-1 pr-3 font-medium">Event</th>
            <th scope="col" className="py-1 pr-3 font-medium">Result</th>
            <th scope="col" className="py-1 pr-3 font-medium">Code</th>
            <th scope="col" className="py-1 font-medium">Duration</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => {
            const status = STATUS[log.status] ?? STATUS.PENDING
            return (
              <tr key={`${log.timestamp}-${i}`} className="border-t align-top">
                <td className="py-2 pr-3 whitespace-nowrap">{formatAbsolute(log.timestamp)}</td>
                <td className="py-2 pr-3">{eventLabel(log.event)}</td>
                <td className="py-2 pr-3">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs', status.className)}>{status.label}</span>
                  {log.errorMessage && <p className="mt-1 text-xs text-muted-foreground">{log.errorMessage}</p>}
                  {log.payload !== undefined && (
                    <details className="mt-1 text-xs">
                      <summary className="cursor-pointer text-primary">Payload</summary>
                      <pre className="mt-1 max-w-[70vw] overflow-x-auto rounded bg-muted p-2">{JSON.stringify(log.payload, null, 2)}</pre>
                    </details>
                  )}
                </td>
                <td className="py-2 pr-3">{log.statusCode ?? ''}</td>
                <td className="py-2 whitespace-nowrap">{log.responseTime !== undefined ? `${log.responseTime} ms` : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
