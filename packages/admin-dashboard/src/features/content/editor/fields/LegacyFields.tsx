import { RichTextEditor } from '@/components/RichTextEditor'
import { MediaPicker } from '@/components/MediaPicker'
import { FieldShell } from './FieldShell'
import type { FieldControlProps } from './field-aria'

// TipTap and the media picker still use MUI; Plan 3 rebuilds the media picker.
export function RichTextField({ field, id, value, onChange, onBlur, error, disabled }: FieldControlProps) {
  return (
    <FieldShell field={field} id={id} error={error}>
      <div id={id} tabIndex={-1} onBlur={onBlur} className={disabled ? 'pointer-events-none opacity-60' : undefined}>
        <RichTextEditor value={typeof value === 'string' ? value : ''} onChange={onChange} placeholder={field.description} />
      </div>
    </FieldShell>
  )
}

export function MediaField({ field, id, value, onChange, onBlur, error, disabled }: FieldControlProps) {
  const multiple = !!field.validation?.multiple
  const current = multiple ? (Array.isArray(value) ? (value as string[]) : []) : typeof value === 'string' ? value : ''
  return (
    <FieldShell field={field} id={id} error={error}>
      <div id={id} tabIndex={-1} className={disabled ? 'pointer-events-none opacity-60' : undefined}>
        <MediaPicker value={current} onChange={(v) => { onChange(v); onBlur() }} multiple={multiple} allowedMimeTypes={field.validation?.allowedMimeTypes} />
      </div>
    </FieldShell>
  )
}
