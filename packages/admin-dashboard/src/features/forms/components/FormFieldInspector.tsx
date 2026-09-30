import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import type { FormFieldDefinition } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { formFieldTypeLabel, type DraftFormField } from '../form-draft'

interface Props {
  field: DraftFormField
  errors: { label?: string; key?: string; options?: string; rules?: string }
  onLabel: (label: string) => void
  onKey: (key: string) => void
  onChange: (patch: Partial<FormFieldDefinition>) => void
  onRemove: () => void
}

function num(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export function FormFieldInspector({ field, errors, onLabel, onKey, onChange, onRemove }: Props) {
  const { t } = useTranslation('forms')
  const v = field.validation ?? {}
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">{t('builder.fieldOfType', { type: formFieldTypeLabel(field.type) })}</p>
      <div className="space-y-1.5">
        <Label htmlFor="ffi-label">{t('inspector.label')}</Label>
        <Input id="ffi-label" value={field.label} onChange={(e) => onLabel(e.target.value)} aria-invalid={errors.label ? true : undefined} />
        {errors.label && <p className="text-sm text-destructive">{errors.label}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ffi-key">{t('inspector.apiKey')}</Label>
        <Input id="ffi-key" className="font-mono" value={field.name} onChange={(e) => onKey(e.target.value)} aria-invalid={errors.key ? true : undefined} />
        {errors.key ? <p className="text-sm text-destructive">{errors.key}</p> : <p className="text-sm text-muted-foreground">{t('inspector.keyHint')}</p>}
      </div>
      {field.type !== 'CHECKBOX' && field.type !== 'DATE' && field.type !== 'SELECT' && (
        <div className="space-y-1.5">
          <Label htmlFor="ffi-placeholder">{t('inspector.placeholder')}</Label>
          <Input id="ffi-placeholder" value={field.placeholder ?? ''} onChange={(e) => onChange({ placeholder: e.target.value })} />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="ffi-required">{t('inspector.required')}</Label>
        <Switch id="ffi-required" checked={!!field.required} onCheckedChange={(checked) => onChange({ required: checked })} />
      </div>
      {field.type === 'SELECT' && (
        <div className="space-y-1.5">
          <Label htmlFor="ffi-options">{t('inspector.options')}</Label>
          <Textarea id="ffi-options" rows={4} value={(field.options ?? []).join('\n')} onChange={(e) => onChange({ options: e.target.value.split('\n') })} aria-invalid={errors.options ? true : undefined} />
          {errors.options && <p className="text-sm text-destructive">{errors.options}</p>}
        </div>
      )}
      {(field.type === 'TEXT' || field.type === 'TEXTAREA') && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ffi-min">{t('inspector.minLength')}</Label>
            <Input id="ffi-min" type="number" value={v.minLength ?? ''} onChange={(e) => onChange({ validation: { ...v, minLength: num(e.target.value) } })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ffi-max">{t('inspector.maxLength')}</Label>
            <Input id="ffi-max" type="number" value={v.maxLength ?? ''} onChange={(e) => onChange({ validation: { ...v, maxLength: num(e.target.value) } })} />
          </div>
        </div>
      )}
      {field.type === 'NUMBER' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="ffi-min">{t('inspector.minimum')}</Label>
            <Input id="ffi-min" type="number" value={v.min ?? ''} onChange={(e) => onChange({ validation: { ...v, min: num(e.target.value) } })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ffi-max">{t('inspector.maximum')}</Label>
            <Input id="ffi-max" type="number" value={v.max ?? ''} onChange={(e) => onChange({ validation: { ...v, max: num(e.target.value) } })} />
          </div>
        </div>
      )}
      {errors.rules && <p role="alert" className="text-sm text-destructive">{errors.rules}</p>}
      <Button type="button" variant="outline" size="sm" className="self-start text-destructive" onClick={onRemove}>
        <Trash2 aria-hidden />
        {t('inspector.remove')}
      </Button>
    </div>
  )
}
