import { RichTextEditor } from '@/components/RichTextEditor'
import { FieldShell } from './FieldShell'
import type { FieldControlProps } from './field-aria'

// TipTap's toolbar still uses MUI until Plan 5.
export function RichTextField({ field, id, value, onChange, onBlur, error, disabled }: FieldControlProps) {
  return (
    <FieldShell field={field} id={id} error={error}>
      <div id={id} tabIndex={-1} onBlur={onBlur} className={disabled ? 'pointer-events-none opacity-60' : undefined}>
        <RichTextEditor value={typeof value === 'string' ? value : ''} onChange={onChange} placeholder={field.description} />
      </div>
    </FieldShell>
  )
}
