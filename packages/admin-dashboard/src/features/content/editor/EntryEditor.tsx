import { useCallback, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { ContentEntry, ContentType, EntryStatus } from '@/types'
import { apiErrorMessage } from '@/lib/api-error'
import { createInitialValues, duplicateData, resolveTitleField, toEntryPayload, type EntryValues } from '@/lib/entry-schema'
import { useAutosave } from '@/lib/hooks/useAutosave'
import { useHotkey } from '@/lib/hooks/useHotkey'
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { useEntryWrites } from '../queries'
import { getEditorActions, type EditorAction } from './editor-actions'
import { useEntryForm } from './useEntryForm'
import { EditorTopBar } from './EditorTopBar'
import { EditorSidePanel } from './EditorSidePanel'
import { UnsavedChangesDialog } from './UnsavedChangesDialog'
import { FieldControl } from './fields/FieldControl'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface EntryEditorProps {
  contentType: ContentType
  entry?: ContentEntry
}

export function EntryEditor({ contentType, entry: initialEntry }: EntryEditorProps) {
  const navigate = useNavigate()
  const writes = useEntryWrites()
  const fields = contentType.fields
  const titleKey = resolveTitleField(fields, contentType.titleField)
  const coverField = fields.find((f) => f.type === 'MEDIA' && !f.validation?.multiple)
  const bodyFields = fields.filter((f) => f.name !== titleKey && f.name !== coverField?.name)

  const [entry, setEntry] = useState<ContentEntry | undefined>(initialEntry)
  const [status, setStatus] = useState<EntryStatus>(initialEntry?.status ?? 'DRAFT')
  const [saveState, setSaveState] = useState<SaveState>(initialEntry ? 'saved' : 'idle')
  const [serverError, setServerError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null)

  const form = useEntryForm(fields, createInitialValues(fields, initialEntry?.data))
  const readOnly = status === 'ARCHIVED'

  // Saves run one after another; the id ref makes a queued save after a create become an update.
  const entryIdRef = useRef<string | undefined>(initialEntry?.id)
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())

  const persist = useCallback(
    (options: { status?: EntryStatus } = {}) => {
      const run = async (): Promise<ContentEntry> => {
        const snapshot: EntryValues = form.values
        const data = toEntryPayload(fields, snapshot)
        setSaveState('saving')
        setServerError(null)
        try {
          let saved: ContentEntry
          if (!entryIdRef.current) {
            saved = await writes.create({ typeId: contentType.id, body: { data, status: options.status ?? 'DRAFT' } })
            entryIdRef.current = saved.id
            navigate(`/content/${saved.id}`, { replace: true, state: { skipGuard: true } })
          } else {
            saved = await writes.update({ id: entryIdRef.current, body: { data } })
          }
          form.markSaved(snapshot)
          setEntry(saved)
          setStatus(saved.status)
          setSaveState('saved')
          return saved
        } catch (error) {
          setSaveState('error')
          setServerError(apiErrorMessage(error))
          throw error
        }
      }
      const next = queueRef.current.then(run, run)
      queueRef.current = next.catch(() => undefined)
      return next
    },
    [form, fields, writes, contentType.id, navigate],
  )

  const autosave = useAutosave({
    enabled: status === 'DRAFT',
    isDirty: form.isDirty,
    isValid: form.isValid,
    changeKey: form.changeKey,
    save: () => persist().catch(() => undefined),
  })

  const blocker = useUnsavedGuard(form.isDirty)

  const requireValid = useCallback(() => {
    if (form.isValid) return true
    form.showAllErrors()
    const count = Object.keys(form.errors).length
    toast.error(`Fix ${count} field${count === 1 ? '' : 's'} before saving`)
    const first = Object.keys(form.errors)[0]
    document.getElementById(`field-${first}`)?.focus()
    return false
  }, [form])

  const act = useCallback(
    async (action: EditorAction) => {
      const id = entryIdRef.current
      setBusy(true)
      try {
        switch (action) {
          case 'saveDraft':
            if (!requireValid()) return
            await persist()
            toast.success('Draft saved')
            break
          case 'publish':
            if (!requireValid()) return
            if (!id) {
              await persist({ status: 'PUBLISHED' })
            } else {
              if (form.isDirty) await persist()
              const published = await writes.publish(id)
              setEntry(published)
              setStatus('PUBLISHED')
            }
            toast.success('Published')
            break
          case 'publishChanges':
            if (!requireValid()) return
            await persist()
            toast.success('Changes published')
            break
          case 'discard':
            form.reset(form.baseline)
            break
          case 'unpublish': {
            const saved = await writes.unpublish(id!)
            setEntry(saved)
            setStatus('DRAFT')
            toast.success('Unpublished. The entry is a draft again.')
            break
          }
          case 'archive':
            setConfirm('archive')
            break
          case 'restore': {
            const saved = await writes.update({ id: id!, body: { status: 'DRAFT' } })
            setEntry(saved)
            setStatus('DRAFT')
            toast.success('Restored to draft')
            break
          }
          case 'delete':
            setConfirm('delete')
            break
          case 'duplicate': {
            const copy = await writes.create({
              typeId: contentType.id,
              body: { data: duplicateData(toEntryPayload(fields, form.values), fields, contentType.titleField), status: 'DRAFT' },
            })
            toast.success('Duplicated. You are editing the copy.')
            navigate(`/content/${copy.id}`)
            break
          }
        }
      } catch (error) {
        toast.error(apiErrorMessage(error))
      } finally {
        setBusy(false)
      }
    },
    [contentType, fields, form, navigate, persist, requireValid, writes],
  )

  const confirmArchive = async () => {
    setConfirm(null)
    try {
      const saved = await writes.archive(entryIdRef.current!)
      setEntry(saved)
      setStatus('ARCHIVED')
      toast.success('Archived')
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const confirmDelete = async () => {
    setConfirm(null)
    try {
      await writes.remove(entryIdRef.current!)
      toast.success('Entry deleted')
      navigate('/content', { state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  useHotkey(
    's',
    (event) => {
      event.preventDefault()
      if (status === 'ARCHIVED') return
      void act(status === 'PUBLISHED' ? 'publishChanges' : 'saveDraft')
    },
    { mod: true, allowInInputs: true },
  )

  const isNew = !entryIdRef.current
  const actions = getEditorActions({ isNew, status, isDirty: form.isDirty })
  const errorCount = Object.keys(form.errors).length

  const saveLabel = useMemo(() => {
    if (saveState === 'saving') return 'Saving…'
    if (saveState === 'error') return 'Save failed'
    if (form.isDirty && !form.isValid && status === 'DRAFT') return `Fix ${errorCount} field${errorCount === 1 ? '' : 's'} to save`
    if (form.isDirty) return 'Unsaved changes'
    if (isNew) return 'Not saved yet'
    return 'Saved'
  }, [saveState, form.isDirty, form.isValid, status, errorCount, isNew])

  const renderField = (fieldName: string, className?: string) => {
    const field = fields.find((f) => f.name === fieldName)!
    return (
      <div className={className}>
        <FieldControl
          field={field}
          id={`field-${field.name}`}
          value={form.values[field.name]}
          onChange={(v) => form.setValue(field.name, v)}
          onBlur={() => {
            form.touch(field.name)
            autosave.flush()
          }}
          error={form.visibleErrors[field.name]}
          disabled={readOnly}
        />
      </div>
    )
  }

  const panel = (
    <EditorSidePanel
      status={status}
      isNew={isNew}
      entry={entry}
      cover={coverField ? renderField(coverField.name) : undefined}
      canArchive={status !== 'ARCHIVED'}
      onArchive={() => setConfirm('archive')}
      onDelete={() => setConfirm('delete')}
    />
  )

  const titleValue = titleKey ? form.values[titleKey] : undefined
  const titleError = titleKey ? form.visibleErrors[titleKey] : undefined

  return (
    <>
      <EditorTopBar
        typeName={contentType.name}
        saveLabel={saveLabel}
        saveTone={saveState === 'error' ? 'error' : 'muted'}
        onRetry={saveState === 'error' ? () => void persist().catch(() => undefined) : undefined}
        actions={actions}
        busy={busy}
        onAction={(a) => void act(a)}
        onOpenDetails={() => setDetailsOpen(true)}
      />
      {serverError && (
        <div role="alert" className="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_280px]">
        <form
          className="flex min-w-0 flex-col gap-6"
          onSubmit={(e) => e.preventDefault()}
          aria-label={`${contentType.name} fields`}
        >
          <fieldset disabled={readOnly} className="contents">
            {titleKey && (
              <div>
                <label htmlFor={`field-${titleKey}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {fields.find((f) => f.name === titleKey)?.label ?? 'Title'}
                </label>
                <input
                  id={`field-${titleKey}`}
                  value={typeof titleValue === 'string' ? titleValue : ''}
                  onChange={(e) => form.setValue(titleKey, e.target.value)}
                  onBlur={() => {
                    form.touch(titleKey)
                    autosave.flush()
                  }}
                  placeholder="Untitled"
                  aria-invalid={titleError ? true : undefined}
                  aria-describedby={titleError ? `field-${titleKey}-error` : undefined}
                  className={cn(
                    'mt-1 w-full border-0 border-b bg-transparent pb-1 font-serif text-3xl font-semibold outline-none placeholder:text-muted-foreground/60 focus:border-ring',
                    titleError && 'border-destructive',
                  )}
                />
                {titleError && <p id={`field-${titleKey}-error`} className="mt-1 text-sm text-destructive">{titleError}</p>}
              </div>
            )}
            <div className="grid gap-6 sm:grid-cols-2">
              {bodyFields.map((f) =>
                renderField(f.name, ['NUMBER', 'DATE', 'BOOLEAN'].includes(f.type) ? undefined : 'sm:col-span-2'),
              )}
            </div>
          </fieldset>
        </form>
        <aside className="hidden lg:block" aria-label="Entry details">
          {panel}
        </aside>
      </div>
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Details</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{panel}</div>
        </SheetContent>
      </Sheet>
      <UnsavedChangesDialog blocker={blocker} />
      <ConfirmDialog
        open={confirm === 'archive'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Archive this entry?"
        description="Sites stop receiving it. You can restore it to draft later."
        confirmLabel="Archive"
        onConfirm={() => void confirmArchive()}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title="Delete this entry?"
        description="This permanently removes the entry and cannot be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}

