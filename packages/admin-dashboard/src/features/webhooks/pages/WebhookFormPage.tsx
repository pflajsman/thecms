import { Trans, useTranslation } from 'react-i18next'
import { i18n } from '@/i18n'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { RefreshCw, Send } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api-error'
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard'
import { stableStringify } from '@/features/content/editor/useEntryForm'
import { UnsavedChangesDialog } from '@/features/content/editor/UnsavedChangesDialog'
import { useSites } from '@/features/sites/sites-api'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { TestResult, Webhook, WebhookPayload } from '../webhooks-api'
import { useWebhook, useWebhookLogs, useWebhookWrites } from '../webhooks-queries'
import { getEventGroups, validateWebhook } from '../webhook-events'
import { SecretDialog } from '../components/SecretDialog'
import { DeliveryLog } from '../components/DeliveryLog'

const EMPTY: WebhookPayload = { name: '', url: '', description: '', events: [] }

export function WebhookFormPage() {
  const { t } = useTranslation('webhooks')
  const { id = 'new' } = useParams()
  const hook = useWebhook(id === 'new' ? undefined : id)
  if (id === 'new') return <WebhookForm key="new" initial={EMPTY} />
  if (hook.isError) return <ErrorState message={t('form.loadError')} onRetry={() => void hook.refetch()} />
  if (!hook.data) return <Skeleton className="h-64 w-full" />
  const h = hook.data
  return (
    <WebhookForm
      key={h.id}
      webhook={h}
      initial={{ name: h.name, url: h.url, description: h.description ?? '', events: h.events, siteId: h.siteId, isActive: h.isActive }}
    />
  )
}

function testMessage(r: TestResult): string {
  if (r.success) return i18n.t('webhooks:test.delivered', { code: r.statusCode ?? '', ms: r.responseTime ?? 0 })
  const error = r.error ?? i18n.t('webhooks:test.noResponse')
  return r.statusCode ? i18n.t('webhooks:test.failedWithCode', { code: r.statusCode, error }) : i18n.t('webhooks:test.failed', { error })
}

function WebhookForm({ webhook, initial }: { webhook?: Webhook; initial: WebhookPayload }) {
  const { t } = useTranslation('webhooks')
  const navigate = useNavigate()
  const writes = useWebhookWrites()
  const sites = useSites()
  const logs = useWebhookLogs(webhook?.id)
  const [draft, setDraft] = useState(initial)
  const [baseline, setBaseline] = useState(() => stableStringify(initial))
  const [showErrors, setShowErrors] = useState(false)
  const [secret, setSecret] = useState<string | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)
  const [testing, setTesting] = useState(false)
  const [confirm, setConfirm] = useState<'rotate' | 'delete' | null>(null)
  const errors = validateWebhook(draft)
  const visible = showErrors ? errors : {}
  const dirty = stableStringify(draft) !== baseline
  const blocker = useUnsavedGuard(dirty && !createdId)

  const toggleEvent = (value: string) =>
    setDraft({ ...draft, events: draft.events.includes(value) ? draft.events.filter((e) => e !== value) : [...draft.events, value] })

  const save = async () => {
    setShowErrors(true)
    if (Object.keys(errors).length) {
      toast.error(t('form.fixFields'))
      return
    }
    const payload: WebhookPayload = { ...draft, name: draft.name.trim(), url: draft.url.trim(), description: draft.description?.trim() }
    // On edit, send null for "All sites" so a previously chosen site is cleared; on create, just omit it.
    if (!payload.siteId) {
      if (webhook) payload.siteId = null
      else delete payload.siteId
    }
    try {
      if (webhook) {
        await writes.update(webhook.id, payload)
        setBaseline(stableStringify(draft))
        toast.success(t('form.saved'))
      } else {
        const created = await writes.create(payload)
        setBaseline(stableStringify(draft))
        setCreatedId(created.id)
        setSecret(created.secret)
        toast.success(t('form.created'))
      }
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const sendTest = async () => {
    setTesting(true)
    try {
      setTestResult(await writes.test(webhook!.id))
    } catch (error) {
      setTestResult({ success: false, error: apiErrorMessage(error) })
    } finally {
      setTesting(false)
    }
  }

  const rotate = async () => {
    setConfirm(null)
    try {
      setSecret(await writes.rotate(webhook!.id))
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const remove = async () => {
    setConfirm(null)
    try {
      await writes.remove(webhook!.id)
      toast.success(t('form.deleted', { name: webhook!.name }))
      navigate('/webhooks', { state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title={draft.name.trim() || t('form.newTitle')}
        breadcrumb={<Link to="/webhooks">{t('list.title')}</Link>}
        actions={
          <>
            {webhook && (
              <Button variant="outline" onClick={() => setConfirm('delete')}>
                {t('form.delete')}
              </Button>
            )}
            <Button onClick={() => void save()} disabled={!!webhook && !dirty}>
              {t('form.save')}
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="wh-name">{t('form.name')}</Label>
            <Input id="wh-name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} aria-invalid={visible.name ? true : undefined} />
            {visible.name && <p className="text-sm text-destructive">{visible.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wh-url">{t('form.url')}</Label>
            <Input
              id="wh-url"
              type="url"
              className="font-mono"
              value={draft.url}
              placeholder="https://example.com/hooks/cms"
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              aria-invalid={visible.url ? true : undefined}
            />
            {visible.url && <p className="text-sm text-destructive">{visible.url}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wh-description">{t('form.description')}</Label>
            <Textarea id="wh-description" rows={2} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">{t('form.events')}</legend>
            {visible.events && <p className="text-sm text-destructive">{visible.events}</p>}
            {getEventGroups().map((group) => (
              <div key={group.label}>
                <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{group.label}</p>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {group.events.map((e) => (
                    <label key={e.value} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" className="size-4 accent-primary" checked={draft.events.includes(e.value)} onChange={() => toggleEvent(e.value)} />
                      {e.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </fieldset>
          <div className="space-y-1.5">
            <Label htmlFor="wh-site">{t('form.site')}</Label>
            <Select value={draft.siteId ?? 'none'} onValueChange={(v) => setDraft({ ...draft, siteId: v === 'none' ? undefined : v })}>
              <SelectTrigger id="wh-site">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('form.allSites')}</SelectItem>
                {(sites.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {webhook && (
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="wh-active">{t('form.active')}</Label>
              <Switch id="wh-active" checked={draft.isActive !== false} onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })} />
            </div>
          )}
        </section>

        {webhook && (
          <div className="flex min-w-0 flex-col gap-6">
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <h2 className="font-serif text-lg font-semibold">{t('secret.title')}</h2>
              <p className="text-sm text-muted-foreground">
                <Trans t={t} i18nKey="secret.preview" values={{ preview: webhook.secretPreview }} components={{ code: <code className="font-mono" /> }} />
              </p>
              <Button variant="outline" size="sm" className="self-start" onClick={() => setConfirm('rotate')}>
                <RefreshCw aria-hidden />
                {t('secret.rotate')}
              </Button>
            </section>
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-serif text-lg font-semibold">{t('form.deliveries')}</h2>
                <Button variant="outline" size="sm" onClick={() => void sendTest()} disabled={testing}>
                  <Send aria-hidden />
                  {testing ? t('form.sending') : t('form.sendTest')}
                </Button>
              </div>
              <div role="status">
                {testResult && <p className={testResult.success ? 'text-sm text-status-published-fg' : 'text-sm text-destructive'}>{testMessage(testResult)}</p>}
              </div>
              <p className="text-sm text-muted-foreground">
                {t('form.counts', { total: webhook.totalDeliveries, delivered: webhook.successfulDeliveries, failed: webhook.failedDeliveries })}
              </p>
              {logs.isPending ? <Skeleton className="h-20 w-full" /> : <DeliveryLog logs={logs.data ?? []} />}
            </section>
          </div>
        )}
      </div>

      <UnsavedChangesDialog blocker={blocker} />
      <SecretDialog
        secret={secret}
        onDone={() => {
          setSecret(null)
          if (createdId) navigate(`/webhooks/${createdId}`, { replace: true, state: { skipGuard: true } })
        }}
      />
      {webhook && (
        <>
          <ConfirmDialog
            open={confirm === 'rotate'}
            onOpenChange={(o) => !o && setConfirm(null)}
            title={t('secret.rotateTitle')}
            description={t('secret.rotateText')}
            confirmLabel={t('secret.rotate')}
            destructive
            onConfirm={() => void rotate()}
          />
          <ConfirmDialog
            open={confirm === 'delete'}
            onOpenChange={(o) => !o && setConfirm(null)}
            title={t('form.deleteTitle', { name: webhook.name })}
            description={t('form.deleteText')}
            confirmLabel={t('actions.delete', { ns: 'common' })}
            destructive
            onConfirm={() => void remove()}
          />
        </>
      )}
    </>
  )
}
