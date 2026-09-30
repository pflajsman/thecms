import { useTranslation } from 'react-i18next'
import type { DeliveryLogEntry, DeliveryStatus } from '../webhooks-api'
import { eventLabel } from '../webhook-events'
import { formatAbsolute } from '@/lib/format'
import { cn } from '@/lib/utils'

const TONE: Record<DeliveryStatus, string> = {
  SUCCESS: 'bg-status-published-bg text-status-published-fg',
  FAILED: 'bg-status-unread-bg text-status-unread-fg',
  RETRYING: 'bg-status-draft-bg text-status-draft-fg',
  PENDING: 'bg-status-draft-bg text-status-draft-fg',
}

export function DeliveryLog({ logs }: { logs: DeliveryLogEntry[] }) {
  const { t } = useTranslation('webhooks')
  if (logs.length === 0) return <p className="text-sm text-muted-foreground">{t('log.empty')}</p>
  return (
    <div className="overflow-x-auto">
      <table aria-label={t('log.label')} className="w-full text-left text-sm">
        <thead className="text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            <th scope="col" className="py-1 pr-3 font-medium">{t('log.time')}</th>
            <th scope="col" className="py-1 pr-3 font-medium">{t('log.event')}</th>
            <th scope="col" className="py-1 pr-3 font-medium">{t('log.result')}</th>
            <th scope="col" className="py-1 pr-3 font-medium">{t('log.code')}</th>
            <th scope="col" className="py-1 font-medium">{t('log.duration')}</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => {
            const status = TONE[log.status] ? log.status : 'PENDING'
            return (
              <tr key={`${log.timestamp}-${i}`} className="border-t align-top">
                <td className="py-2 pr-3 whitespace-nowrap">{formatAbsolute(log.timestamp)}</td>
                <td className="py-2 pr-3">{eventLabel(log.event)}</td>
                <td className="py-2 pr-3">
                  <span className={cn('rounded-full px-2 py-0.5 text-xs', TONE[status])}>{t(`log.status.${status}`)}</span>
                  {log.errorMessage && <p className="mt-1 text-xs text-muted-foreground">{log.errorMessage}</p>}
                  {log.payload !== undefined && (
                    <details className="mt-1 text-xs">
                      <summary className="cursor-pointer text-primary">{t('log.payload')}</summary>
                      <pre className="mt-1 max-w-[70vw] overflow-x-auto rounded bg-muted p-2">{JSON.stringify(log.payload, null, 2)}</pre>
                    </details>
                  )}
                </td>
                <td className="py-2 pr-3">{log.statusCode ?? ''}</td>
                <td className="py-2 whitespace-nowrap">{log.responseTime !== undefined ? t('log.ms', { ms: log.responseTime }) : ''}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
