import { useTranslation } from 'react-i18next'
import { useState, type FormEvent, type ReactNode } from 'react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { formatDate, formatNumber } from '@/lib/format'
import { CLAUDE_MODELS, type AiConnection, type AiProviderName, type ConnectionInput } from '../ai-api'
import { useAiStatus, useAiWrites } from '../ai-queries'
import { aiErrorMessage } from '../ai-errors'

export const AI_PRESETS = [
  { id: 'ollama', label: 'Ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3.2' },
  { id: 'openrouter', label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: '' },
  { id: 'groq', label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: '' },
  { id: 'gemini', label: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: '' },
] as const

const MODEL_LABEL = { 'claude-sonnet-5': 'sonnet', 'claude-opus-5-5': 'opus', 'claude-haiku-4-5-20251001': 'haiku' } as const
const CUSTOM = 'custom'
const selectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
const isHttp = (text: string) => {
  try {
    return ['http:', 'https:'].includes(new URL(text.trim()).protocol)
  } catch {
    return false
  }
}
const trimSlash = (url: string) => url.trim().replace(/\/+$/, '')

interface FormState {
  provider: AiProviderName
  model: string
  baseUrl: string
  apiKey: string
  preset: string
}

function initialForm(current: AiConnection | null): FormState {
  const preset = AI_PRESETS.find((p) => p.baseUrl === current?.baseUrl)?.id ?? CUSTOM
  return { provider: current?.provider ?? 'anthropic', model: current?.model ?? 'claude-sonnet-5', baseUrl: current?.baseUrl ?? '', apiKey: '', preset }
}

function Note({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border bg-muted/40 px-4 py-3 text-sm">{children}</p>
}

function FieldError({ id, text }: { id: string; text?: string }) {
  return text ? <p id={id} className="text-sm text-destructive">{text}</p> : null
}

function ConnectionForm({ current, onDone, onCancel }: { current: AiConnection | null; onDone: () => void; onCancel?: () => void }) {
  const { t } = useTranslation('ai')
  const writes = useAiWrites()
  const [form, setForm] = useState<FormState>(() => initialForm(current))
  const [errors, setErrors] = useState<{ apiKey?: string; baseUrl?: string; model?: string }>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const update = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }))
  // The server keeps the stored key when the provider (and address) stay the same.
  const keepsKey = !!current?.keyHint && current.provider === form.provider && (form.provider === 'anthropic' || current.baseUrl === trimSlash(form.baseUrl))

  const switchProvider = (provider: AiProviderName) =>
    update(provider === 'anthropic' ? { provider, model: 'claude-sonnet-5' } : { provider, model: current?.provider === provider ? current.model : '', baseUrl: current?.baseUrl ?? '' })

  const pickPreset = (id: string) => {
    const preset = AI_PRESETS.find((p) => p.id === id)
    update(preset ? { preset: id, baseUrl: preset.baseUrl, model: preset.model || form.model } : { preset: id })
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    const apiKey = form.apiKey.trim()
    if (form.provider === 'anthropic' && !apiKey && !keepsKey) next.apiKey = t('settings.errors.keyRequired')
    if (form.provider === 'openai-compatible') {
      if (!isHttp(form.baseUrl)) next.baseUrl = t('settings.errors.baseUrlInvalid')
      if (!form.model.trim()) next.model = t('settings.errors.modelRequired')
    }
    setErrors(next)
    if (Object.keys(next).length) return
    const body: ConnectionInput =
      form.provider === 'anthropic'
        ? { provider: 'anthropic', model: form.model, ...(apiKey ? { apiKey } : {}) }
        : { provider: 'openai-compatible', model: form.model.trim(), baseUrl: trimSlash(form.baseUrl), ...(apiKey ? { apiKey } : {}) }
    setPending(true)
    setServerError(null)
    try {
      await writes.save(body)
      toast.success(t('settings.saved'))
      onDone()
    } catch (error) {
      setServerError(aiErrorMessage(error, t))
    } finally {
      setPending(false)
    }
  }

  const keyLabel = form.provider === 'anthropic' ? t('settings.apiKey') : t('settings.apiKeyOptional')
  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="space-y-5 rounded-xl border bg-card p-5">
      {serverError && (
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">{serverError}</div>
      )}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('settings.provider')}</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="provider" className="size-4 accent-primary" checked={form.provider === 'anthropic'} onChange={() => switchProvider('anthropic')} />
          {t('settings.providerAnthropic')}
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="radio" name="provider" className="size-4 accent-primary" checked={form.provider === 'openai-compatible'} onChange={() => switchProvider('openai-compatible')} aria-describedby="ai-openai-hint" />
          {t('settings.providerOpenAi')}
        </label>
        <p id="ai-openai-hint" className="text-xs text-muted-foreground">{t('settings.providerOpenAiHint')}</p>
      </fieldset>

      {form.provider === 'openai-compatible' && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="ai-preset">{t('settings.preset')}</Label>
            <select id="ai-preset" className={selectClass} value={form.preset} onChange={(e) => pickPreset(e.target.value)} aria-describedby="ai-preset-hint">
              <option value={CUSTOM}>{t('settings.presetCustom')}</option>
              {AI_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <p id="ai-preset-hint" className="text-xs text-muted-foreground">{t('settings.presetHint')}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-base-url">{t('settings.baseUrl')}</Label>
            <Input id="ai-base-url" type="url" value={form.baseUrl} onChange={(e) => update({ baseUrl: e.target.value, preset: CUSTOM })} aria-invalid={errors.baseUrl ? true : undefined} aria-describedby={errors.baseUrl ? 'ai-base-url-error' : undefined} />
            <FieldError id="ai-base-url-error" text={errors.baseUrl} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai-model-name">{t('settings.modelName')}</Label>
            <Input id="ai-model-name" value={form.model} onChange={(e) => update({ model: e.target.value })} aria-invalid={errors.model ? true : undefined} aria-describedby={errors.model ? 'ai-model-name-error' : 'ai-model-name-hint'} />
            <p id="ai-model-name-hint" className="text-xs text-muted-foreground">{t('settings.modelNameHint')}</p>
            <FieldError id="ai-model-name-error" text={errors.model} />
          </div>
        </>
      )}

      {form.provider === 'anthropic' && (
        <div className="space-y-1.5">
          <Label htmlFor="ai-model">{t('settings.model')}</Label>
          <select id="ai-model" className={selectClass} value={form.model} onChange={(e) => update({ model: e.target.value })}>
            {CLAUDE_MODELS.map((m) => (
              <option key={m} value={m}>{t(`models.${MODEL_LABEL[m]}`)}</option>
            ))}
          </select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="ai-key">{keyLabel}</Label>
        <Input
          id="ai-key"
          type="password"
          autoComplete="off"
          value={form.apiKey}
          onChange={(e) => update({ apiKey: e.target.value })}
          aria-invalid={errors.apiKey ? true : undefined}
          aria-describedby={errors.apiKey ? 'ai-key-error' : keepsKey ? 'ai-key-keep' : undefined}
        />
        {keepsKey && <p id="ai-key-keep" className="text-xs text-muted-foreground">{t('settings.keepKey')}</p>}
        <FieldError id="ai-key-error" text={errors.apiKey} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending}>{pending ? t('settings.testing') : t('settings.connect')}</Button>
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>{t('settings.cancel')}</Button>
        )}
      </div>
    </form>
  )
}

export function AiSettingsPage() {
  const { t } = useTranslation('ai')
  const status = useAiStatus()
  const writes = useAiWrites()
  const [editing, setEditing] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  if (status.isPending) return <Skeleton className="h-40 w-full" />
  if (status.isError && !status.data) return <ErrorState message={t('settings.loadError')} onRetry={() => void status.refetch()} />
  if (!status.data) return <ErrorState message={t('settings.noAccess')} />
  const s = status.data
  const providerName = (c: AiConnection) => (c.provider === 'anthropic' ? t('settings.providerAnthropic') : t('settings.providerOpenAi'))

  const disconnect = async () => {
    try {
      await writes.disconnect()
      toast.success(t('settings.disconnected'))
      setEditing(false)
    } catch (error) {
      toast.error(aiErrorMessage(error, t))
    } finally {
      setConfirmDisconnect(false)
    }
  }

  const toggle = async (enabled: boolean) => {
    try {
      await writes.setEnabled(enabled)
    } catch (error) {
      toast.error(aiErrorMessage(error, t))
    }
  }

  let body: ReactNode
  if (!s.available) body = <Note>{t('settings.notAvailable')}</Note>
  else if (!s.enabled) body = <Note>{t('settings.disabled')}</Note>
  else if (s.connection && !editing) {
    const c = s.connection
    body = (
      <section aria-labelledby="ai-connected" className="space-y-2 rounded-xl border bg-card p-5">
        <h2 id="ai-connected" className="font-serif text-lg font-semibold">{t('settings.connected')}</h2>
        <p>{t('settings.connectedTo', { provider: providerName(c), model: c.model })}</p>
        {c.baseUrl && <p className="break-all font-mono text-sm text-muted-foreground">{c.baseUrl}</p>}
        <p className="text-sm text-muted-foreground">{c.keyHint ? t('settings.keyEnding', { hint: c.keyHint }) : t('settings.noKey')}</p>
        <p className="text-sm text-muted-foreground">{t('settings.since', { date: formatDate(c.createdAt) })}</p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" onClick={() => setEditing(true)}>{t('settings.change')}</Button>
          <Button variant="outline" className="text-destructive" onClick={() => setConfirmDisconnect(true)}>{t('settings.disconnect')}</Button>
        </div>
      </section>
    )
  } else body = <ConnectionForm current={s.connection} onDone={() => setEditing(false)} onCancel={s.connection ? () => setEditing(false) : undefined} />

  return (
    <>
      <PageHeader title={t('settings.title')} description={t('settings.description')} />
      <div className="max-w-2xl space-y-6">
        {s.canManage && s.available && (
          <div className="flex items-start gap-3 rounded-xl border bg-card p-4">
            <Switch id="ai-allow-all" checked={s.enabled} onCheckedChange={(v) => void toggle(v)} aria-describedby="ai-allow-all-hint" />
            <div className="space-y-1">
              <Label htmlFor="ai-allow-all">{t('settings.allowAll')}</Label>
              <p id="ai-allow-all-hint" className="text-xs text-muted-foreground">{t('settings.allowAllHint')}</p>
            </div>
          </div>
        )}
        {body}
        {s.available && (
          <section aria-labelledby="ai-usage" className="space-y-1">
            <h2 id="ai-usage" className="text-sm font-medium">{t('settings.usage')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('settings.usageText', { count: s.usage.requests, input: formatNumber(s.usage.inputTokens), output: formatNumber(s.usage.outputTokens) })}
            </p>
          </section>
        )}
      </div>
      <ConfirmDialog
        open={confirmDisconnect}
        onOpenChange={setConfirmDisconnect}
        title={t('settings.disconnectTitle')}
        description={t('settings.disconnectText')}
        confirmLabel={t('settings.disconnect')}
        destructive
        onConfirm={() => void disconnect()}
      />
    </>
  )
}
