import type { ReactNode } from 'react'
import type { Field } from '@/types'
import { Label } from '@/components/ui/label'

export function FieldShell({ field, id, error, counter, children }: { field: Field; id: string; error?: string; counter?: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id} className="text-sm font-medium">
          {field.label || field.name}
          {field.required && <span aria-hidden className="text-destructive"> *</span>}
        </Label>
        {counter}
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
