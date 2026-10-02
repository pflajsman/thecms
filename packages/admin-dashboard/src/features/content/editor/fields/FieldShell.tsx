import { useContext, type ReactNode } from 'react'
import type { Field } from '@/types'
import { Label } from '@/components/ui/label'
import { FieldAddonContext } from './field-addon'

export function FieldShell({ field, id, error, counter, children }: { field: Field; id: string; error?: string; counter?: ReactNode; children: ReactNode }) {
  const addon = useContext(FieldAddonContext)
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {field.label || field.name}
          {field.required && <span aria-hidden className="text-destructive"> *</span>}
        </Label>
        <div className="flex items-center gap-2">
          {addon}
          {counter}
        </div>
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>
      ) : (
        field.description && <p id={`${id}-help`} className="text-sm text-muted-foreground">{field.description}</p>
      )}
    </div>
  )
}
