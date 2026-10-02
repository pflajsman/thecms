import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { Field } from '@/types'
import { FieldAddonContext } from '@/features/content/editor/fields/field-addon'
import { AiRequestError, streamGenerate, type AiAction, type GenerateRequest } from '../ai-api'
import { useAiReady } from '../ai-queries'
import { SETTINGS_CODES, aiErrorKey, type AiErrorKey } from '../ai-errors'
import { cleanRichText, toPlainText } from '../rich-text-clean'

interface AiFieldProps {
  field: Field
  value: unknown
  onApply: (value: string) => void
  /** The entry's other text, the model name and the version language, for the prompt. */
  getContext: (fieldName: string) => GenerateRequest['context']
  disabled?: boolean
  /** Renders the field; `version` changes after a result is applied so editors that read their value once remount. */
  children: (version: number) => ReactNode
}

type Panel =
  | { kind: 'instruction'; action: 'draft' | 'custom'; instruction: string }
  | { kind: 'running' | 'done' | 'error'; action: AiAction; instruction?: string; text: string; truncated?: boolean; error?: { key: AiErrorKey | null; message: string } }

const FILLED_ACTIONS: AiAction[] = ['rewrite', 'shorten', 'expand', 'fix']
const DRAFT: AiAction = 'draft'
const CUSTOM: AiAction = 'custom'
const REPLACE = 'replace'
const APPEND = 'append'

export function AiField({ field, value, onApply, getContext, disabled, children }: AiFieldProps) {
  const { t } = useTranslation('ai')
  const ready = useAiReady()
  const [panel, setPanel] = useState<Panel | null>(null)
  const [version, setVersion] = useState(0)
  const request = useRef<AbortController | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const focusField = useRef(false)
  const focusBrief = useRef(false)
  // Leaving the editor stops a running answer.
  useEffect(() => () => request.current?.abort(), [])
  // After Use the field has remounted; put focus back into it.
  useEffect(() => {
    if (!focusField.current) return
    focusField.current = false
    const target = document.getElementById(`field-${field.name}`)
    const focusable = target?.matches('input, textarea, [contenteditable="true"]') ? target : target?.querySelector<HTMLElement>('input, textarea, [contenteditable="true"]')
    focusable?.focus()
  }, [version, field.name])

  const supported = field.type === 'TEXT' || field.type === 'RICH_TEXT'
  // The field is always rendered in the same place, so it keeps its state when AI becomes ready.
  const active = ready && supported && !disabled

  const label = field.label || field.name
  const current = typeof value === 'string' ? value : ''
  const empty = toPlainText(current) === ''
  const rich = field.type === 'RICH_TEXT'

  const run = async (action: AiAction, instruction?: string) => {
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    setPanel({ kind: 'running', action, instruction, text: '' })
    try {
      const result = await streamGenerate(
        { action, ...(instruction ? { instruction } : {}), field: { label, type: rich ? 'RICH_TEXT' : 'TEXT', value: current }, context: getContext(field.name) },
        { signal: controller.signal, onText: (text) => setPanel((p) => (p && p.kind === 'running' ? { ...p, text } : p)) },
      )
      if (controller.signal.aborted) return
      setPanel({ kind: 'done', action, instruction, text: result.text, truncated: result.truncated })
    } catch (error) {
      if (controller.signal.aborted) return
      const known = error instanceof AiRequestError ? error : new AiRequestError('PROVIDER', String(error))
      setPanel((p) => ({ kind: 'error', action, instruction, text: p && 'text' in p ? p.text : '', error: { key: aiErrorKey(known.code), message: known.message } }))
    }
  }

  const close = () => {
    request.current?.abort()
    request.current = null
    setPanel(null)
    trigger.current?.focus()
  }

  const apply = (mode: typeof REPLACE | typeof APPEND) => {
    if (!panel || panel.kind !== 'done') return
    const cleaned = rich ? cleanRichText(panel.text) : toPlainText(panel.text)
    onApply(mode === APPEND ? `${current}${cleaned}` : cleaned)
    focusField.current = true
    setVersion((v) => v + 1)
    setPanel(null)
  }

  const pick = (action: AiAction) => {
    if (action === 'draft' || action === 'custom') {
      request.current?.abort()
      request.current = null
      focusBrief.current = true
      setPanel({ kind: 'instruction', action, instruction: '' })
    } else void run(action)
  }

  const instructionId = `ai-instruction-${field.name}`
  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button ref={trigger} type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" aria-label={t('menu.open', { field: label })}>
          <Sparkles aria-hidden className="size-3.5" />
          {t('menu.short')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={(e) => {
          // The menu would return focus to its button; the brief box takes it instead.
          if (!focusBrief.current) return
          focusBrief.current = false
          e.preventDefault()
          document.getElementById(instructionId)?.focus()
        }}>
        {empty ? (
          <DropdownMenuItem onSelect={() => pick(DRAFT)}>{t('menu.draft')}</DropdownMenuItem>
        ) : (
          FILLED_ACTIONS.map((a) => (
            <DropdownMenuItem key={a} onSelect={() => pick(a)}>{t(`menu.${a}`)}</DropdownMenuItem>
          ))
        )}
        <DropdownMenuItem onSelect={() => pick(CUSTOM)}>{t('menu.custom')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  let content: ReactNode = null
  if (panel?.kind === 'instruction') {
    content = (
      // Not a <form>: the editor around this field is one, and a nested form would submit the page.
      <div className="space-y-2">
        <Label htmlFor={instructionId}>{panel.action === 'draft' ? t('panel.instructionDraft') : t('panel.instructionCustom')}</Label>
        <Textarea
          id={instructionId}
          autoFocus
          value={panel.instruction}
          maxLength={1000}
          onChange={(e) => setPanel({ ...panel, instruction: e.target.value })}
          onKeyDown={(e) => {
            // Ctrl or Cmd + Enter starts it, like a send button.
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && panel.instruction.trim()) {
              e.preventDefault()
              void run(panel.action, panel.instruction.trim())
            }
          }}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" disabled={!panel.instruction.trim()} onClick={() => void run(panel.action, panel.instruction.trim())}>{t('panel.run')}</Button>
          <Button type="button" size="sm" variant="outline" onClick={close}>{t('panel.discard')}</Button>
        </div>
      </div>
    )
  } else if (panel) {
    const shown = rich ? cleanRichText(panel.text) : toPlainText(panel.text)
    // Use replaces the whole field, and AI answers carry no images, so it would drop them.
    const keepsImages = rich && /<img\b/i.test(current)
    content = (
      <div className="space-y-3">
        {panel.kind === 'running' && !shown && <p className="text-sm text-muted-foreground">{t('panel.writing')}</p>}
        {shown &&
          (rich ? (
            <div className="prose prose-sm max-w-none break-words" dangerouslySetInnerHTML={{ __html: shown }} />
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm">{shown}</p>
          ))}
        {panel.kind === 'done' && !shown && <p className="text-sm text-muted-foreground">{t('panel.empty')}</p>}
        {panel.kind === 'done' && panel.truncated && <p className="text-sm text-amber-700 dark:text-amber-400">{t('panel.truncated')}</p>}
        {panel.kind === 'done' && shown && keepsImages && <p className="text-sm text-muted-foreground">{t('panel.keepsImages')}</p>}
        {panel.kind === 'error' && panel.error && (
          <div role="alert" className="space-y-1 text-sm text-destructive">
            <p>{panel.error.key ? t(`errors.${panel.error.key}`) : panel.error.message}</p>
            {panel.error.key && SETTINGS_CODES.includes(panel.error.key) && (
              <Link to="/account/ai" className="underline underline-offset-2">{t('panel.openSettings')}</Link>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {panel.kind === 'done' && shown && !keepsImages && (
            <Button type="button" size="sm" onClick={() => apply(REPLACE)}>{t('panel.use')}</Button>
          )}
          {panel.kind === 'done' && shown && rich && (
            <Button type="button" size="sm" variant="outline" onClick={() => apply(APPEND)}>{t('panel.insertBelow')}</Button>
          )}
          {panel.kind !== 'running' && (
            <Button type="button" size="sm" variant="outline" onClick={() => void run(panel.action, panel.instruction)}>{t('panel.retry')}</Button>
          )}
          <Button type="button" size="sm" variant="ghost" onClick={close}>{t('panel.discard')}</Button>
        </div>
      </div>
    )
  }

  return (
    <FieldAddonContext.Provider value={active ? menu : null}>
      {children(version)}
      {active && panel && (
        <section aria-label={t('panel.title', { field: label })} aria-busy={panel.kind === 'running'} className="mt-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
          {content}
        </section>
      )}
    </FieldAddonContext.Provider>
  )
}
