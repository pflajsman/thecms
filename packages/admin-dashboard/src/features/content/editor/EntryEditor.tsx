import { useTranslation } from 'react-i18next'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import type { ContentEntry, ContentType, EntryStatus, Field } from '@/types'
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
import { useLanguages } from '@/features/languages/languages-queries'
import { isLocalized } from '@/lib/localized'
import { useVersions } from '../queries'
import { LanguageMenu } from './LanguageMenu'
import { LanguagesSection } from './LanguagesSection'
import { ChangeLanguageDialog } from './ChangeLanguageDialog'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface EntryEditorProps {
  contentType: ContentType
  entry?: ContentEntry
}

export function EntryEditor({ contentType, entry: initialEntry }: EntryEditorProps) {
  const navigate = useNavigate()
  const { t } = useTranslation('editor')
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

  const languagesQuery = useLanguages()
  const languages = useMemo(() => languagesQuery.data ?? [], [languagesQuery.data])
  const multilingual = languages.length > 1
  const versionsQuery = useVersions(entry, { enabled: multilingual })
  const versions = versionsQuery.data ?? []
  const defaultLanguage = languages.find((l) => l.isDefault)
  const language = entry?.language ?? defaultLanguage?.code ?? 'en'
  const languageName = (code: string) => languages.find((l) => l.code === code)?.name ?? code
  const showLanguages = multilingual && !!entry && versions.length > 0
  const [changeOpen, setChangeOpen] = useState(false)

  const form = useEntryForm(fields, createInitialValues(fields, initialEntry?.data))
  const readOnly = status === 'ARCHIVED'

  // Saves run one after another; the id ref makes a queued save after a create become an update.
  const entryIdRef = useRef<string | undefined>(initialEntry?.id)
  const queueRef = useRef<Promise<unknown>>(Promise.resolve())
  // A create can finish after the user has left the editor; never pull them back.
  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])
  const [resetCount, setResetCount] = useState(0)

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
            if (mountedRef.current) {
              // editorKey keeps this editor mounted across the /content/new -> /content/:id redirect.
              navigate(`/content/${saved.id}`, { replace: true, state: { skipGuard: true, editorKey: 'new' } })
            }
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
    toast.error(t('fixFieldsToast', { count }))
    const first = Object.keys(form.errors)[0]
    if (first === coverField?.name && !window.matchMedia('(min-width: 1024px)').matches) {
      setDetailsOpen(true)
      return false
    }
    const el = document.getElementById(`field-${first}`)
    el?.focus()
    el?.scrollIntoView?.({ block: 'center' })
    return false
  }, [form, coverField?.name, t])

  const act = useCallback(
    async (action: EditorAction) => {
      const id = entryIdRef.current
      setBusy(true)
      try {
        switch (action) {
          case 'saveDraft':
            if (!requireValid()) return
            await persist()
            toast.success(t('toast.draftSaved'))
            break
          case 'publish':
            if (!requireValid()) return
            {
              // A blur or autosave may already be creating this entry as a draft, so the
              // queued save can come back as a draft: publish explicitly in that case.
              const saved = !id || form.isDirty ? await persist({ status: 'PUBLISHED' }) : undefined
              if (saved?.status !== 'PUBLISHED') {
                const published = await writes.publish(saved?.id ?? id!)
                setEntry(published)
                setStatus('PUBLISHED')
              }
            }
            toast.success(t('toast.published'))
            break
          case 'publishChanges':
            if (!requireValid()) return
            await persist()
            toast.success(t('toast.changesPublished'))
            break
          case 'discard':
            form.reset(form.baseline)
            // Remount the fields: TipTap reads its content only on mount.
            setResetCount((n) => n + 1)
            break
          case 'unpublish': {
            const saved = await writes.unpublish(id!)
            setEntry(saved)
            setStatus('DRAFT')
            toast.success(t('toast.unpublished'))
            break
          }
          case 'archive':
            setConfirm('archive')
            break
          case 'restore': {
            const saved = await writes.update({ id: id!, body: { status: 'DRAFT' } })
            setEntry(saved)
            setStatus('DRAFT')
            toast.success(t('toast.restored'))
            break
          }
          case 'delete':
            setConfirm('delete')
            break
          case 'duplicate': {
            const copy = await writes.create({
              typeId: contentType.id,
              body: { data: duplicateData(toEntryPayload(fields, form.values), fields, contentType.titleField), status: 'DRAFT', language: entry?.language },
            })
            toast.success(t('toast.duplicated'))
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
    [contentType, entry?.language, fields, form, navigate, persist, requireValid, writes, t],
  )

  const confirmArchive = async () => {
    setConfirm(null)
    try {
      const saved = await writes.archive(entryIdRef.current!)
      setEntry(saved)
      setStatus('ARCHIVED')
      toast.success(t('toast.archived'))
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const confirmDelete = async () => {
    setConfirm(null)
    try {
      await writes.remove(entryIdRef.current!)
      toast.success(t('toast.deleted'))
      navigate('/content', { state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const translate = async (code: string) => {
    setBusy(true)
    try {
      const created = await writes.translate(entryIdRef.current!, code)
      toast.success(t('languages.translated', { language: languageName(code) }))
      navigate(`/content/${created.id}`)
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const changeLanguage = async (code: string) => {
    setBusy(true)
    try {
      const moved = await writes.changeLanguage(entryIdRef.current!, code)
      setEntry(moved)
      setChangeOpen(false)
      toast.success(t('languages.changed', { language: languageName(code) }))
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const sharedHint = (field: { type: Field['type']; localized?: boolean }) =>
    multilingual && !isLocalized(field) ? <p className="mt-1 text-xs text-muted-foreground">{t('languages.sharedHint')}</p> : null

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
    if (saveState === 'saving') return t('save.saving')
    if (saveState === 'error') return t('save.failed')
    if (form.isDirty && !form.isValid && status === 'DRAFT') return t('fixFieldsStatus', { count: errorCount })
    if (form.isDirty) return t('save.unsaved')
    if (isNew) return t('save.notSaved')
    return t('save.saved')
  }, [saveState, form.isDirty, form.isValid, status, errorCount, isNew, t])

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
        {sharedHint(field)}
      </div>
    )
  }

  const panel = (
    <EditorSidePanel
      status={status}
      isNew={isNew}
      entry={entry}
      cover={coverField ? <div key={resetCount}>{renderField(coverField.name)}</div> : undefined}
      canArchive={status !== 'ARCHIVED'}
      onArchive={() => setConfirm('archive')}
      onDelete={() => setConfirm('delete')}
      languages={showLanguages ? <LanguagesSection languages={languages} versions={versions} current={language} onChange={() => setChangeOpen(true)} /> : undefined}
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
        languageMenu={
          showLanguages ? (
            <LanguageMenu
              languages={languages}
              versions={versions}
              current={language}
              canTranslate={!form.isDirty}
              busy={busy}
              onOpen={(id) => navigate(`/content/${id}`)}
              onTranslate={(code) => void translate(code)}
            />
          ) : undefined
        }
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
          aria-label={t('fieldsLabel', { model: contentType.name })}
        >
          <fieldset key={resetCount} disabled={readOnly} className="contents">
            {titleKey && (
              <div>
                <label htmlFor={`field-${titleKey}`} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {fields.find((f) => f.name === titleKey)?.label ?? t('titleFallback')}
                </label>
                <input
                  id={`field-${titleKey}`}
                  value={typeof titleValue === 'string' ? titleValue : ''}
                  onChange={(e) => form.setValue(titleKey, e.target.value)}
                  onBlur={() => {
                    form.touch(titleKey)
                    autosave.flush()
                  }}
                  placeholder={t('titlePlaceholder')}
                  aria-invalid={titleError ? true : undefined}
                  aria-describedby={titleError ? `field-${titleKey}-error` : undefined}
                  className={cn(
                    'mt-1 w-full border-0 border-b bg-transparent pb-1 font-serif text-3xl font-semibold outline-none placeholder:text-muted-foreground/60 focus:border-ring',
                    titleError && 'border-destructive',
                  )}
                />
                {titleError && <p id={`field-${titleKey}-error`} className="mt-1 text-sm text-destructive">{titleError}</p>}
                {sharedHint(fields.find((f) => f.name === titleKey)!)}
              </div>
            )}
            <div className="grid gap-6 sm:grid-cols-2">
              {bodyFields.map((f) =>
                renderField(f.name, ['NUMBER', 'DATE', 'BOOLEAN'].includes(f.type) ? undefined : 'sm:col-span-2'),
              )}
            </div>
          </fieldset>
        </form>
        <aside className="hidden lg:block" aria-label={t('entryDetails')}>
          {panel}
        </aside>
      </div>
      <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t('details')}</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-6">{panel}</div>
        </SheetContent>
      </Sheet>
      <UnsavedChangesDialog blocker={blocker} />
      <ChangeLanguageDialog
        open={changeOpen}
        onOpenChange={setChangeOpen}
        free={languages.filter((l) => !versions.some((v) => v.language === l.code))}
        current={language}
        defaultLanguage={defaultLanguage}
        defaultCovered={versions.some((v) => v.language === defaultLanguage?.code && v.id !== entry?.id)}
        pending={busy}
        onConfirm={(code) => void changeLanguage(code)}
      />
      <ConfirmDialog
        open={confirm === 'archive'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('confirm.archiveTitle')}
        description={t('confirm.archiveText')}
        confirmLabel={t('actions.archive')}
        onConfirm={() => void confirmArchive()}
      />
      <ConfirmDialog
        open={confirm === 'delete'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={t('confirm.deleteTitle')}
        description={versions.length > 1 ? t('confirm.deleteVersionText', { language: languageName(language) }) : t('confirm.deleteText')}
        confirmLabel={t('actions.delete')}
        destructive
        onConfirm={() => void confirmDelete()}
      />
    </>
  )
}

