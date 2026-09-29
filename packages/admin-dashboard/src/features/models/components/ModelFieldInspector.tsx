import { Lock, Star, Trash2 } from 'lucide-react'
import type { ContentType, Field, ValidationRules } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { FIELD_TYPE_LABELS, type DraftField } from '../model-draft'

interface ModelFieldInspectorProps {
  field: DraftField
  isTitle: boolean
  locked: boolean
  errors: { label?: string; key?: string }
  models: ContentType[]
  onLabel: (label: string) => void
  onKey: (key: string) => void
  onChange: (patch: Partial<Field>) => void
  onMakeTitle: () => void
  onRemove: () => void
}

const FILE_CHOICES = [
  { value: 'image/*', label: 'Images' },
  { value: 'video/*', label: 'Video' },
  { value: 'application/gpx+xml', label: 'GPX' },
  { value: 'application/pdf', label: 'PDF' },
]

function num(value: string): number | undefined {
  if (value.trim() === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

export function ModelFieldInspector({ field, isTitle, locked, errors, models, onLabel, onKey, onChange, onMakeTitle, onRemove }: ModelFieldInspectorProps) {
  const v: ValidationRules = field.validation ?? {}
  const setRule = (patch: Partial<ValidationRules>) => onChange({ validation: { ...v, ...patch } })
  const numberInput = (id: string, label: string, value: number | undefined, key: keyof ValidationRules) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" value={value ?? ''} onChange={(e) => setRule({ [key]: num(e.target.value) } as Partial<ValidationRules>)} />
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-muted-foreground">{FIELD_TYPE_LABELS[field.type]} field</p>
      <div className="space-y-1.5">
        <Label htmlFor="fi-label">Label</Label>
        <Input id="fi-label" value={field.label} onChange={(e) => onLabel(e.target.value)} aria-invalid={errors.label ? true : undefined} />
        {errors.label && <p className="text-sm text-destructive">{errors.label}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fi-key" className="flex items-center gap-1.5">
          API key
          {locked && <Lock aria-hidden className="size-3.5 text-muted-foreground" />}
        </Label>
        <Input id="fi-key" value={field.name} onChange={(e) => onKey(e.target.value)} className="font-mono" aria-invalid={errors.key ? true : undefined} />
        {errors.key ? (
          <p className="text-sm text-destructive">{errors.key}</p>
        ) : locked ? (
          <p className="text-sm text-status-draft-fg">Sites reading this key stop receiving it if you rename it.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Created from the label. Your site reads the value by this key.</p>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fi-description">Help text</Label>
        <Textarea id="fi-description" rows={2} value={field.description ?? ''} onChange={(e) => onChange({ description: e.target.value })} />
      </div>
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor="fi-required">Required</Label>
        <Switch id="fi-required" checked={!!field.required} onCheckedChange={(checked) => onChange({ required: checked })} />
      </div>

      {field.type === 'TEXT' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {numberInput('fi-min', 'Min length', v.minLength, 'minLength')}
            {numberInput('fi-max', 'Max length', v.maxLength, 'maxLength')}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fi-pattern">Pattern (regular expression)</Label>
            <Input id="fi-pattern" className="font-mono" value={v.pattern ?? ''} onChange={(e) => setRule({ pattern: e.target.value })} />
          </div>
          <Button type="button" variant={isTitle ? 'secondary' : 'outline'} size="sm" className="self-start" onClick={onMakeTitle} disabled={isTitle}>
            <Star aria-hidden className={cn('size-4', isTitle && 'fill-current')} />
            {isTitle ? 'This is the title' : 'Use as title'}
          </Button>
        </>
      )}
      {field.type === 'RICH_TEXT' && numberInput('fi-max', 'Max length', v.maxLength, 'maxLength')}
      {field.type === 'NUMBER' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {numberInput('fi-min', 'Minimum', v.min, 'min')}
            {numberInput('fi-max', 'Maximum', v.max, 'max')}
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="fi-integer">Whole numbers only</Label>
            <Switch id="fi-integer" checked={!!v.integer} onCheckedChange={(checked) => setRule({ integer: checked })} />
          </div>
        </>
      )}
      {(field.type === 'MEDIA' || field.type === 'RELATION') && (
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="fi-multiple">Allow several</Label>
          <Switch id="fi-multiple" checked={!!v.multiple} onCheckedChange={(checked) => setRule({ multiple: checked })} />
        </div>
      )}
      {field.type === 'MEDIA' && (
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Allowed files</legend>
          <div className="flex flex-wrap gap-1.5">
            {FILE_CHOICES.map((c) => {
              const on = v.allowedMimeTypes?.includes(c.value) ?? false
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setRule({ allowedMimeTypes: on ? v.allowedMimeTypes!.filter((x) => x !== c.value) : [...(v.allowedMimeTypes ?? []), c.value] })}
                  className={cn('rounded-full border px-3 py-1 text-sm', on ? 'border-foreground bg-foreground text-background' : 'bg-card hover:bg-accent')}
                >
                  {c.label}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">None selected means any supported file.</p>
        </fieldset>
      )}
      {field.type === 'RELATION' && (
        <div className="space-y-1.5">
          <Label htmlFor="fi-target">Entries from</Label>
          <Select value={v.targetContentType ?? 'any'} onValueChange={(value) => setRule({ targetContentType: value === 'any' ? undefined : value })}>
            <SelectTrigger id="fi-target">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any content model</SelectItem>
              {models.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button type="button" variant="outline" size="sm" className="self-start text-destructive" onClick={onRemove}>
        <Trash2 aria-hidden />
        Remove field
      </Button>
    </div>
  )
}
