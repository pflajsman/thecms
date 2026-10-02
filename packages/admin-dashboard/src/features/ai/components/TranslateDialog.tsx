import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Check, CircleDashed, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AiRequestError, streamTranslate, type TranslateField } from '../ai-api'
import { aiKeys } from '../ai-queries'
import { SETTINGS_CODES, aiErrorKey } from '../ai-errors'

interface TranslateDialogProps {
  entryId: string
  language: { code: string; name: string }
  onDone: (versionId: string) => void
  onExists: () => void
  onClose: () => void
}

type FieldState = 'done' | 'current' | 'waiting' | 'failed'
const STATE_KEYS = { done: 'translate.stateDone', current: 'translate.stateCurrent', waiting: 'translate.stateWaiting', failed: 'translate.stateFailed' } as const
const RETRY_CODES = ['RATE_LIMIT', 'UNREACHABLE', 'TIMEOUT', 'PROVIDER', 'AI_RATE_LIMIT', 'NETWORK']
const NO_RETRY_CODES = ['TOO_LONG', 'TRUNCATED', 'VERSION_EXISTS', ...SETTINGS_CODES, 'AI_DISABLED', 'AI_NOT_AVAILABLE']
const SETTINGS_PATH = '/account/ai'

function StateIcon({ state }: { state: FieldState }) {
  if (state === 'done') return <Check aria-hidden className="size-4 text-primary" />
  if (state === 'current') return <Loader2 aria-hidden className="size-4 animate-spin" />
  if (state === 'failed') return <X aria-hidden className="size-4 text-destructive" />
  return <CircleDashed aria-hidden className="size-4 text-muted-foreground" />
}

/** Translates the saved version into `language`; mounted while open, and unmounting stops the request. */
export function TranslateDialog({ entryId, language, onDone, onExists, onClose }: TranslateDialogProps) {
  const { t } = useTranslation('ai')
  const queryClient = useQueryClient()
  const [fields, setFields] = useState<TranslateField[]>([])
  const [index, setIndex] = useState(0)
  const [error, setError] = useState<AiRequestError | null>(null)
  const [attempt, setAttempt] = useState(0)
  // The latest onDone, without restarting the request when the parent re-renders.
  const doneRef = useRef(onDone)
  useEffect(() => {
    doneRef.current = onDone
  })

  useEffect(() => {
    const controller = new AbortController()
    streamTranslate({ entryId, language: language.code }, { signal: controller.signal, onStart: setFields, onField: (_name, i) => setIndex(i) })
      .then((result) => {
        if (!controller.signal.aborted) doneRef.current(result.versionId)
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return
        setError(e instanceof AiRequestError ? e : new AiRequestError('PROVIDER', String(e)))
      })
      // Tokens may have been used even when the run failed.
      .finally(() => void queryClient.invalidateQueries({ queryKey: aiKeys.status }))
    return () => controller.abort()
  }, [entryId, language.code, attempt, queryClient])

  // A new run starts from a clean list.
  const retry = () => {
    setFields([])
    setIndex(0)
    setError(null)
    setAttempt((a) => a + 1)
  }

  const stateOf = (f: TranslateField, i: number): FieldState => {
    if (error?.field === f.name) return 'failed'
    if (i + 1 < index) return 'done'
    if (i + 1 === index && !error) return 'current'
    return 'waiting'
  }
  const fieldLabel = (name?: string) => (name ? (fields.find((f) => f.name === name)?.label ?? name) : undefined)
  const current = fields[index - 1]

  const errorText = (e: AiRequestError): string => {
    const field = fieldLabel(e.field)
    if (e.code === 'TOO_LONG' && field) return t('translate.tooLong', { field })
    if (e.code === 'TRUNCATED' && field) return t('translate.truncated', { field })
    if (e.code === 'VERSION_EXISTS') return t('translate.exists', { language: language.name })
    const key = aiErrorKey(e.code)
    // Server texts are English: a failure without its own explanation gets the general one.
    return key ? t(`errors.${key}`) : t('translate.failed')
  }
  const canRetry = !!error && (RETRY_CODES.includes(error.code) || !NO_RETRY_CODES.includes(error.code))
  const settingsKey = error ? aiErrorKey(error.code) : null
  const stoppedAt = error && !['TOO_LONG', 'TRUNCATED'].includes(error.code) ? fieldLabel(error.field) : undefined

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false} className="max-w-[calc(100vw-2rem)] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('translate.title', { language: language.name })}</DialogTitle>
          <DialogDescription>{t('translate.description')}</DialogDescription>
        </DialogHeader>

        {fields.length > 0 && (
          <ol className="space-y-1.5 text-sm">
            {fields.map((f, i) => {
              const state = stateOf(f, i)
              return (
                <li key={f.name} className="flex items-center gap-2">
                  <StateIcon state={state} />
                  <span className="flex-1 break-words">{f.label}</span>
                  <span className="text-xs text-muted-foreground">{t(STATE_KEYS[state])}</span>
                </li>
              )
            })}
          </ol>
        )}

        <p role="status" className="text-sm text-muted-foreground">
          {!error && (current ? t('translate.progress', { field: current.label, index, total: fields.length }) : t('translate.starting'))}
        </p>

        {error && (
          <div role="alert" className="space-y-1 text-sm text-destructive">
            <p>{errorText(error)}</p>
            {stoppedAt && <p>{t('translate.stoppedAt', { field: stoppedAt })}</p>}
            {settingsKey && SETTINGS_CODES.includes(settingsKey) && (
              <Link to={SETTINGS_PATH} className="underline underline-offset-2">
                {t('panel.openSettings')}
              </Link>
            )}
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {error?.code === 'VERSION_EXISTS' && (
            <Button type="button" onClick={onExists}>
              {t('translate.openExisting', { language: language.name })}
            </Button>
          )}
          {canRetry && (
            <Button type="button" onClick={retry}>
              {t('translate.retry')}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            {error ? t('translate.close') : t('translate.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
