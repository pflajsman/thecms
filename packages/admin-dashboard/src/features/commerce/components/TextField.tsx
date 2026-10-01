import type { HTMLAttributes } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

interface TextFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  hint?: string
  error?: string
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode']
  type?: string
  className?: string
}

/** Label, input, hint and error, wired together for screen readers. */
export function TextField({ id, label, value, onChange, hint, error, inputMode, type, className }: TextFieldProps) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined
  return (
    <div className={cn('min-w-0 space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} inputMode={inputMode} aria-invalid={error ? true : undefined} aria-describedby={describedBy} />
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
      {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
