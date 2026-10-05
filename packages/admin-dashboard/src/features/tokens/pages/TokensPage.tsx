import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Copy, KeyRound } from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { apiErrorMessage } from '@/lib/api-error'
import { formatDate } from '@/lib/format'
import { MAX_TOKENS, mcpCommand, type AccessToken, type CreatedToken, type TokenExpiry } from '../tokens-api'
import { useTokenWrites, useTokens } from '../tokens-queries'
import { useOptionalProject } from '@/features/projects/ProjectContext'

const EXPIRY_OPTIONS = [
  { value: '30', key: 'create.days30' },
  { value: '90', key: 'create.days90' },
  { value: '365', key: 'create.days365' },
  { value: 'never', key: 'create.never' },
] as const
const NEVER = 'never'
const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

function CopyRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  const { t } = useTranslation('tokens')
  const id = `token-copy-${label.replace(/\W+/g, '-').toLowerCase()}`
  const copy = () => void navigator.clipboard?.writeText(value).then(() => toast.success(t('created.copied')))
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-start gap-2">
        {multiline ? (
          <pre id={id} className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-md border bg-muted px-3 py-2 font-mono text-xs">{value}</pre>
        ) : (
          <Input id={id} readOnly value={value} className="min-w-0 flex-1 font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        )}
        <Button type="button" variant="outline" size="sm" aria-label={`${t('created.copy')} ${label}`} onClick={copy}>
          <Copy aria-hidden />
          {t('created.copy')}
        </Button>
      </div>
    </div>
  )
}

export function TokensPage() {
  const { t } = useTranslation('tokens')
  const project = useOptionalProject()?.project
  const tokens = useTokens()
  const writes = useTokenWrites()
  const [name, setName] = useState('')
  const [expiry, setExpiry] = useState<string>('90')
  const [creating, setCreating] = useState(false)
  // Held only in this component: it disappears with Done or when the page is left.
  const [created, setCreated] = useState<CreatedToken | null>(null)
  const [revoking, setRevoking] = useState<AccessToken | null>(null)
  const busy = useRef(false)
  const createdHeading = useRef<HTMLHeadingElement>(null)
  // The token is shown only once: move focus to it so keyboard and screen-reader users notice it.
  useEffect(() => {
    if (created) createdHeading.current?.focus()
  }, [created])

  if (tokens.isPending) return <Skeleton className="h-40 w-full" />
  if (tokens.isError && !tokens.data) return <ErrorState message={t('loadError')} onRetry={() => void tokens.refetch()} />

  const list = tokens.data ?? []
  const atLimit = list.filter((tk) => !tk.expired).length >= MAX_TOKENS

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (busy.current || !name.trim() || atLimit) return
    busy.current = true
    setCreating(true)
    try {
      const token = await writes.create({ name: name.trim(), ...(expiry === NEVER ? {} : { expiresInDays: Number(expiry) as TokenExpiry }) })
      setCreated(token)
      setName('')
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      busy.current = false
      setCreating(false)
    }
  }

  const revoke = async () => {
    if (!revoking) return
    try {
      await writes.revoke(revoking.id)
      toast.success(t('revoke.done'))
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setRevoking(null)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t('title')} description={t('description')} />
      <p className="rounded-lg border bg-muted/40 p-3 text-sm">
        {t('allows')}
        {project && <> {t('project', { project: project.name })}</>}
      </p>

      {created && (
        <section aria-label={t('created.title')} className="space-y-3 rounded-lg border border-primary/40 bg-primary/5 p-4">
          <h2 ref={createdHeading} tabIndex={-1} className="font-medium outline-none">
            {t('created.title')}
          </h2>
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">{t('created.once')}</p>
          <CopyRow label={t('created.token')} value={created.token} />
          <CopyRow label={t('created.command')} value={mcpCommand(created.token)} multiline />
          <Button type="button" onClick={() => setCreated(null)}>
            {t('created.done')}
          </Button>
        </section>
      )}

      <form onSubmit={(e) => void submit(e)} className="space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">{t('create.title')}</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <div className="space-y-1.5">
            <Label htmlFor="token-name">{t('create.name')}</Label>
            <Input id="token-name" value={name} maxLength={100} placeholder={t('create.namePlaceholder')} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="token-expiry">{t('create.expiry')}</Label>
            <select id="token-expiry" className={selectClass} value={expiry} onChange={(e) => setExpiry(e.target.value)}>
              {EXPIRY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {t(o.key)}
                </option>
              ))}
            </select>
          </div>
        </div>
        {atLimit && <p className="text-sm text-muted-foreground">{t('create.limit')}</p>}
        <Button type="submit" disabled={creating || !name.trim() || atLimit}>
          <KeyRound aria-hidden />
          {t('create.submit')}
        </Button>
      </form>

      <section aria-labelledby="tokens-list-title" className="space-y-3">
        <h2 id="tokens-list-title" className="font-medium">
          {t('list.title')}
        </h2>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('list.empty')}</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {list.map((tk) => (
              <li key={tk.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 p-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="break-words font-medium">{tk.name}</span>
                    <code className="text-xs text-muted-foreground">{tk.prefix}…</code>
                    {tk.expired && <Badge variant="secondary">{t('list.expired')}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t('list.created', { date: formatDate(tk.createdAt) })}
                    {' · '}
                    {tk.lastUsedAt ? t('list.lastUsed', { date: formatDate(tk.lastUsedAt) }) : t('list.neverUsed')}
                    {' · '}
                    {tk.expiresAt ? t('list.expires', { date: formatDate(tk.expiresAt) }) : t('list.noExpiry')}
                  </p>
                </div>
                <Button type="button" variant="outline" size="sm" aria-label={t('list.revokeLabel', { name: tk.name })} onClick={() => setRevoking(tk)}>
                  {t('list.revoke')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!revoking}
        onOpenChange={(open) => !open && setRevoking(null)}
        title={t('revoke.title')}
        description={t('revoke.text', { name: revoking?.name ?? '' })}
        confirmLabel={t('revoke.confirm')}
        destructive
        onConfirm={() => void revoke()}
      />
    </div>
  )
}
