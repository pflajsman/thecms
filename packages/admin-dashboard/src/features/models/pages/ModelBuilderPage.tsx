import { useTranslation } from 'react-i18next'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { ContentType, FieldType } from '@/types'
import { apiErrorMessage } from '@/lib/api-error'
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard'
import { stableStringify } from '@/features/content/editor/useEntryForm'
import { UnsavedChangesDialog } from '@/features/content/editor/UnsavedChangesDialog'
import { useContentType, useContentTypes } from '@/features/content/queries'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { FieldList } from '@/features/builder/FieldList'
import { InspectorPanel } from '@/features/builder/InspectorPanel'
import { useEntryCount, useModelWrites } from '../models-queries'
import {
  fieldTypeLabel,
  addField,
  diffKeys,
  draftFromTemplate,
  draftFromType,
  emptyDraft,
  removeField,
  reorderFields,
  setFieldKey,
  setFieldLabel,
  setModelName,
  setSlug,
  setTitleField,
  toModelPayload,
  updateField,
  validateModel,
  type ModelDraft,
} from '../model-draft'
import { getModelTemplates } from '../templates'
import { TemplateChooser } from '../components/TemplateChooser'
import { ModelFieldInspector } from '../components/ModelFieldInspector'

const PALETTE: FieldType[] = ['TEXT', 'RICH_TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'MEDIA', 'RELATION']

export function ModelBuilderPage() {
  const { id = 'new' } = useParams()
  const { t: tr } = useTranslation('models')
  const [params, setParams] = useSearchParams()
  const isNew = id === 'new'
  const typeQuery = useContentType(isNew ? undefined : id)

  if (isNew) {
    const templateId = params.get('template')
    if (!templateId) {
      return (
        <>
          <PageHeader title={tr('builder.newTitle')} description={tr('builder.newText')} breadcrumb={<Link to="/models">{tr('list.title')}</Link>} />
          <TemplateChooser onChoose={(t) => setParams({ template: t ? t.id : 'scratch' }, { replace: true })} />
        </>
      )
    }
    const template = getModelTemplates().find((t) => t.id === templateId)
    return <ModelBuilder key={`new:${templateId}`} initial={template ? draftFromTemplate(template) : emptyDraft()} />
  }

  if (typeQuery.isError) return <ErrorState message={tr('builder.loadError')} onRetry={() => void typeQuery.refetch()} />
  if (!typeQuery.data) return <Skeleton className="h-64 w-full" />
  return <ModelBuilder key={typeQuery.data.id} model={typeQuery.data} initial={draftFromType(typeQuery.data)} />
}

function ModelBuilder({ model, initial }: { model?: ContentType; initial: ModelDraft }) {
  const navigate = useNavigate()
  const { t: tr } = useTranslation('models')
  const writes = useModelWrites()
  const models = useContentTypes()
  const entryCount = useEntryCount(model?.id)
  const [draft, setDraft] = useState(initial)
  const [baseline, setBaseline] = useState(() => stableStringify(toModelPayload(initial)))
  const [selected, setSelected] = useState<string | undefined>()
  const [showErrors, setShowErrors] = useState(false)
  const [confirm, setConfirm] = useState<'save' | 'delete' | null>(null)
  const [saving, setSaving] = useState(false)

  const errors = useMemo(() => validateModel(draft), [draft])
  const visible = showErrors ? errors : {}
  const dirty = stableStringify(toModelPayload(draft)) !== baseline
  const blocker = useUnsavedGuard(dirty)
  const count = entryCount.data ?? 0
  // Unknown count (loading or failed) is treated as "may have entries" for the key guardrail.
  const countKnown = entryCount.isSuccess
  const diff = diffKeys(draft)
  const selectedField = draft.fields.find((f) => f.cid === selected)

  const save = async () => {
    setConfirm(null)
    setSaving(true)
    try {
      const payload = toModelPayload(draft)
      const saved = model ? await writes.update(model.id, payload) : await writes.create(payload)
      setBaseline(stableStringify(payload))
      toast.success(model ? tr('builder.saved') : tr('builder.created'))
      if (!model) navigate(`/models/${saved.id}`, { replace: true, state: { skipGuard: true } })
      else {
        setDraft(draftFromType(saved))
        setSelected(undefined)
      }
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const requestSave = () => {
    setShowErrors(true)
    const keys = Object.keys(errors)
    if (keys.length) {
      const fieldKey = keys.find((k) => k.includes(':'))
      if (fieldKey) setSelected(fieldKey.split(':')[1])
      toast.error(tr('builder.fixFields'))
      return
    }
    if (model && (!countKnown || count > 0) && (diff.renamed.length || diff.removed.length)) {
      setConfirm('save')
      return
    }
    void save()
  }

  const remove = async () => {
    setConfirm(null)
    try {
      await writes.remove(model!.id, count > 0)
      toast.success(tr('builder.deleted', { name: model!.name }))
      navigate('/models', { state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const fieldError = (cid: string) => ({ label: visible[`label:${cid}`], key: visible[`key:${cid}`], rules: visible[`rules:${cid}`] })

  return (
    <>
      <PageHeader
        title={draft.name.trim() || tr('builder.newTitle')}
        breadcrumb={<Link to="/models">{tr('list.title')}</Link>}
        description={model ? `${tr('count.fields', { count: draft.fields.length })} · ${tr('count.entries', { count })}` : undefined}
        actions={
          <>
            {model && (
              <Button variant="outline" onClick={() => setConfirm('delete')}>
                {tr('builder.deleteModel')}
              </Button>
            )}
            <Button onClick={requestSave} disabled={saving || (!!model && !dirty)}>
              {saving ? tr('builder.saving') : tr('builder.save')}
            </Button>
          </>
        }
      />

      <section className="mb-6 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="model-name">{tr('builder.name')}</Label>
          <Input id="model-name" value={draft.name} onChange={(e) => setDraft(setModelName(draft, e.target.value))} aria-invalid={visible.name ? true : undefined} />
          {visible.name && <p className="text-sm text-destructive">{visible.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="model-slug">{tr('builder.slug')}</Label>
          <Input id="model-slug" className="font-mono" value={draft.slug} onChange={(e) => setDraft(setSlug(draft, e.target.value))} aria-invalid={visible.slug ? true : undefined} />
          {visible.slug ? <p className="text-sm text-destructive">{visible.slug}</p> : <p className="text-sm text-muted-foreground">{tr('builder.slugHint', { slug: draft.slug || 'slug' })}</p>}
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="model-description">{tr('builder.description')}</Label>
          <Textarea id="model-description" rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section>
          <h2 className="mb-2 font-serif text-lg font-semibold">{tr('builder.fields')}</h2>
          {visible.fields && <p className="mb-2 text-sm text-destructive">{visible.fields}</p>}
          <FieldList
            label={tr('builder.fields')}
            items={draft.fields.map((f) => ({
              id: f.cid,
              label: f.label,
              apiKey: f.name,
              typeLabel: fieldTypeLabel(f.type),
              isTitle: f.cid === draft.titleCid && f.type === 'TEXT',
              hasError: !!(visible[`label:${f.cid}`] || visible[`key:${f.cid}`] || visible[`rules:${f.cid}`]),
            }))}
            selectedId={selected}
            onSelect={setSelected}
            onReorder={(cids) => setDraft(reorderFields(draft, cids))}
          />
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{tr('builder.addFieldHeading')}</p>
            <div className="flex flex-wrap gap-2">
              {PALETTE.map((type) => (
                <Button
                  key={type}
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={tr('builder.addField', { type: fieldTypeLabel(type) })}
                  onClick={() => {
                    const { draft: next, cid } = addField(draft, type)
                    setDraft(next)
                    setSelected(cid)
                  }}
                >
                  + {fieldTypeLabel(type)}
                </Button>
              ))}
            </div>
          </div>
        </section>
        <InspectorPanel title={tr('builder.fieldSettings')} open={!!selectedField} onClose={() => setSelected(undefined)}>
          {selectedField && (
            <ModelFieldInspector
              key={selectedField.cid}
              field={selectedField}
              isTitle={selectedField.cid === draft.titleCid}
              locked={!!selectedField.originalName && count > 0}
              errors={fieldError(selectedField.cid)}
              models={(models.data ?? []).filter((m) => m.id !== model?.id)}
              onLabel={(label) => setDraft(setFieldLabel(draft, selectedField.cid, label))}
              onKey={(key) => setDraft(setFieldKey(draft, selectedField.cid, key))}
              onChange={(patch) => setDraft(updateField(draft, selectedField.cid, patch))}
              onMakeTitle={() => setDraft(setTitleField(draft, selectedField.cid))}
              onRemove={() => {
                setDraft(removeField(draft, selectedField.cid))
                setSelected(undefined)
              }}
            />
          )}
        </InspectorPanel>
      </div>

      <UnsavedChangesDialog blocker={blocker} />
      <ConfirmDialog
        open={confirm === 'save'}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={tr('builder.renameTitle')}
        description={
          <span className="block space-y-2">
            <span className="block">
              {countKnown ? tr('builder.usedBy', { count }) : tr('builder.mayHaveEntries')} {tr('builder.renameConsequence')}
            </span>
            <span className="block font-mono text-xs">
              {[...diff.renamed.map((r) => `${r.from} → ${r.to}`), ...diff.removed.map((r) => tr('builder.removedKey', { key: r }))].join(', ')}
            </span>
          </span>
        }
        confirmLabel={tr('builder.saveChanges')}
        onConfirm={() => void save()}
      />
      {model && (
        <ConfirmDialog
          open={confirm === 'delete'}
          onOpenChange={(o) => !o && setConfirm(null)}
          title={tr('builder.deleteTitle', { name: model.name })}
          description={count > 0 ? tr('builder.deleteWithEntries', { count }) : tr('builder.cannotUndo')}
          confirmText={count > 0 ? model.name : undefined}
          confirmLabel={tr('actions.delete', { ns: 'common' })}
          destructive
          onConfirm={() => void remove()}
        />
      )}
    </>
  )
}
