import { useState } from 'react'
import { CalendarIcon, X } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { FieldShell } from './FieldShell'
import { describedBy, type FieldControlProps } from './field-aria'

export function DateField(props: FieldControlProps) {
  const { field, id, value, onChange, onBlur, error, disabled } = props
  const [open, setOpen] = useState(false)
  const date = typeof value === 'string' && !Number.isNaN(new Date(value).getTime()) ? new Date(value) : undefined

  return (
    <FieldShell field={field} id={id} error={error}>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) onBlur() }}>
          <PopoverTrigger asChild>
            <Button id={id} variant="outline" disabled={disabled} className="w-full justify-start rounded-md font-normal sm:w-64" {...describedBy(id, field, error)}>
              <CalendarIcon aria-hidden />
              {date ? format(date, 'd MMM yyyy') : <span className="text-muted-foreground">Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => { onChange(d ? d.toISOString() : undefined); setOpen(false) }}
              autoFocus
            />
          </PopoverContent>
        </Popover>
        {date && !disabled && (
          <Button variant="ghost" size="icon" aria-label={`Clear ${field.label}`} onClick={() => { onChange(undefined); onBlur() }}>
            <X aria-hidden />
          </Button>
        )}
      </div>
    </FieldShell>
  )
}
