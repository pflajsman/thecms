import { useTranslation } from 'react-i18next'
import {useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import type { ContactForm, FormFieldType } from '@/types'
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
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FieldList } from '@/features/builder/FieldList'
import { InspectorPanel } from '@/features/builder/InspectorPanel'
import { useForm, useFormWrites } from '../forms-api'
import {
  formFieldTypeLabel,
  addFormField,
  draftFromForm,
  newFormDraft,
  removeFormField,
  reorderFormFields,
  setFormFieldKey,
  setFormFieldLabel,
  setFormName,
  setFormSlug,
  toFormPayload,
  updateFormField,
  validateForm,
  type FormDraft,
} from '../form-draft'
import { FormFieldInspector } from '../components/FormFieldInspector'
import { FormPreview } from '../components/FormPreview'
import { EmbedPanel } from '../components/EmbedPanel'

const PALETTE: FormFieldType[] = ['TEXT', 'EMAIL', 'TEXTAREA', 'SELECT', 'NUMBER', 'CHECKBOX', 'DATE']

export function FormBuilderPage() {
  const { t } = useTranslation('forms')
  const { id = 'new' } = useParams()
  const isNew = id === 'new'
  const formQuery = useForm(isNew ? undefined : id)
  if (isNew) return <FormBuilder key="new" initial={newFormDraft()} />
  if (formQuery.isError) return <ErrorState message={t('builder.loadError')} onRetry={() => void formQuery.refetch()} />
  if (!formQuery.data) return <Skeleton className="h-64 w-full" />
  return <FormBuilder key={formQuery.data.id} form={formQuery.data} initial={draftFromForm(formQuery.data)} />
}

function FormBuilder({ form, initial }: { form?: ContactForm; initial: FormDraft }) {
  const navigate = useNavigate()
  const { t } = useTranslation('forms')
  const writes = useFormWrites()
  const sites = useSites()
  const [draft, setDraft] = useState(initial)
  const [baseline, setBaseline] = useState(() => stableStringify(toFormPayload(initial)))
  const [selected, setSelected] = useState<string | undefined>()
  const [showErrors, setShowErrors] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)

  // Recomputed each render so messages follow a language switch (validation is cheap).
  const errors = validateForm(draft)
  const visible = showErrors ? errors : {}
  const payload = toFormPayload(draft)
  const dirty = stableStringify(payload) !== baseline
  const blocker = useUnsavedGuard(dirty)
  const selectedField = draft.fields.find((f) => f.cid === selected)
  const site = sites.data?.find((s) => s.id === draft.siteId) ?? sites.data?.[0]

  const save = async () => {
    setShowErrors(true)
    const keys = Object.keys(errors)
    if (keys.length) {
      const fieldKey = keys.find((k) => k.includes(':'))
      if (fieldKey) setSelected(fieldKey.split(':')[1])
      toast.error(t('builder.fixFields'))
      return
    }
    setSaving(true)
    try {
      const saved = form ? await writes.update(form.id, payload) : await writes.create(payload)
      setBaseline(stableStringify(payload))
      toast.success(form ? t('builder.saved') : t('builder.created'))
      if (!form) navigate(`/forms/${saved.id}`, { replace: true, state: { skipGuard: true } })
      else {
        // Re-draft from the server so saved fields keep their keys when labels change.
        setDraft(draftFromForm(saved))
        setSelected(undefined)
      }
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    setConfirmDelete(false)
    try {
      await writes.remove(form!.id)
      toast.success(t('builder.deleted', { name: form!.name }))
      navigate('/forms', { state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title={draft.name.trim() || t('builder.newTitle')}
        breadcrumb={<Link to="/forms">{t('list.title')}</Link>}
        actions={
          <>
            {form && <Button variant="outline" onClick={() => setConfirmDelete(true)}>{t('builder.deleteForm')}</Button>}
            <Button onClick={() => void save()} disabled={saving || (!!form && !dirty)}>{saving ? t('builder.saving') : t('builder.save')}</Button>
          </>
        }
      />
      <section className="mb-6 grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="form-name">{t('builder.name')}</Label>
          <Input id="form-name" value={draft.name} onChange={(e) => setDraft(setFormName(draft, e.target.value))} aria-invalid={visible.name ? true : undefined} />
          {visible.name && <p className="text-sm text-destructive">{visible.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="form-slug">{t('builder.slug')}</Label>
          <Input id="form-slug" className="font-mono" value={draft.slug} onChange={(e) => setDraft(setFormSlug(draft, e.target.value))} aria-invalid={visible.slug ? true : undefined} />
          {visible.slug && <p className="text-sm text-destructive">{visible.slug}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="form-recipient">{t('builder.sendTo')}</Label>
          <Input id="form-recipient" type="email" value={draft.recipientEmail} onChange={(e) => setDraft({ ...draft, recipientEmail: e.target.value })} aria-invalid={visible.recipientEmail ? true : undefined} />
          {visible.recipientEmail && <p className="text-sm text-destructive">{visible.recipientEmail}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="form-site">{t('builder.site')}</Label>
          <Select value={draft.siteId ?? 'none'} onValueChange={(v) => setDraft({ ...draft, siteId: v === 'none' ? undefined : v })}>
            <SelectTrigger id="form-site"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('builder.anySite')}</SelectItem>
              {(sites.data ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-2 sm:col-span-2">
          <Label htmlFor="form-active">{t('builder.accept')}</Label>
          <Switch id="form-active" checked={draft.isActive} onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })} />
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <section>
          <h2 className="mb-2 font-serif text-lg font-semibold">{t('builder.fields')}</h2>
          {visible.fields && <p className="mb-2 text-sm text-destructive">{visible.fields}</p>}
          <FieldList
            label={t('builder.fieldsLabel')}
            items={draft.fields.map((f) => ({ id: f.cid, label: f.label, apiKey: f.name, typeLabel: formFieldTypeLabel(f.type), hasError: !!(visible[`label:${f.cid}`] || visible[`key:${f.cid}`] || visible[`options:${f.cid}`] || visible[`rules:${f.cid}`]) }))}
            selectedId={selected}
            onSelect={setSelected}
            onReorder={(cids) => setDraft(reorderFormFields(draft, cids))}
          />
          <div className="mt-4 flex flex-wrap gap-2">
            {PALETTE.map((type) => (
              <Button key={type} type="button" variant="outline" size="sm" aria-label={t('builder.addField', { type: formFieldTypeLabel(type) })} onClick={() => { const { draft: next, cid } = addFormField(draft, type); setDraft(next); setSelected(cid) }}>
                + {formFieldTypeLabel(type)}
              </Button>
            ))}
          </div>
          <div className="mt-6">
            <InspectorPanel title={t('builder.fieldSettings')} open={!!selectedField} onClose={() => setSelected(undefined)}>
              {selectedField && (
                <FormFieldInspector
                  key={selectedField.cid}
                  field={selectedField}
                  errors={{ label: visible[`label:${selectedField.cid}`], key: visible[`key:${selectedField.cid}`], options: visible[`options:${selectedField.cid}`], rules: visible[`rules:${selectedField.cid}`] }}
                  onLabel={(label) => setDraft(setFormFieldLabel(draft, selectedField.cid, label))}
                  onKey={(key) => setDraft(setFormFieldKey(draft, selectedField.cid, key))}
                  onChange={(patch) => setDraft(updateFormField(draft, selectedField.cid, patch))}
                  onRemove={() => { setDraft(removeFormField(draft, selectedField.cid)); setSelected(undefined) }}
                />
              )}
            </InspectorPanel>
          </div>
        </section>
        <div className="flex flex-col gap-6">
          <FormPreview name={draft.name} fields={payload.fields} />
          <EmbedPanel slug={draft.slug} fields={payload.fields} apiKey={site?.apiKey} />
        </div>
      </div>

      <UnsavedChangesDialog blocker={blocker} />
      {form && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t('builder.deleteTitle', { name: form.name })}
          description={form.submissionCount > 0 ? t('builder.deleteWithSubmissions', { count: form.submissionCount }) : t('builder.cannotUndo')}
          confirmLabel={t('actions.delete', { ns: 'common' })}
          destructive
          onConfirm={() => void remove()}
        />
      )}
    </>
  )
}
