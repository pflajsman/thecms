import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { FieldShell } from './FieldShell'
import { describedBy, type FieldControlProps } from './field-aria'

export function TextField(props: FieldControlProps) {
  const { field, id, value, onChange, onBlur, error, disabled } = props
  const text = typeof value === 'string' ? value : ''
  const max = field.validation?.maxLength
  return (
    <FieldShell field={field} id={id} error={error} counter={max ? <span className="text-xs text-muted-foreground">{text.length}/{max}</span> : undefined}>
      <Input id={id} value={text} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} disabled={disabled} {...describedBy(id, field, error)} />
    </FieldShell>
  )
}

export function NumberField(props: FieldControlProps) {
  const { field, id, value, onChange, onBlur, error, disabled } = props
  return (
    <FieldShell field={field} id={id} error={error}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        value={typeof value === 'number' && Number.isFinite(value) ? value : ''}
        min={field.validation?.min}
        max={field.validation?.max}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.valueAsNumber)}
        onBlur={onBlur}
        disabled={disabled}
        {...describedBy(id, field, error)}
      />
    </FieldShell>
  )
}

export function BooleanField(props: FieldControlProps) {
  const { field, id, value, onChange, onBlur, error, disabled } = props
  return (
    <FieldShell field={field} id={id} error={error}>
      <Switch id={id} checked={value === true} onCheckedChange={(checked) => { onChange(checked); onBlur() }} disabled={disabled} {...describedBy(id, field, error)} />
    </FieldShell>
  )
}
