import { useTranslation } from 'react-i18next'
import type { FormFieldDefinition } from '@/types'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

export function FormPreview({ name, fields }: { name: string; fields: FormFieldDefinition[] }) {
  const { t } = useTranslation('forms')
  return (
    <section aria-label={t('preview.title')} className="rounded-xl border bg-card p-4">
      <h2 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('preview.title')}</h2>
      <p className="mb-4 font-serif text-xl font-semibold">{name || t('preview.untitled')}</p>
      <form className="flex flex-col gap-3" onSubmit={(e) => e.preventDefault()}>
        {fields.map((f, i) => {
          const id = `preview-${i}`
          const label = (
            <Label htmlFor={id}>
              {f.label || t('list.untitled', { ns: 'builder' })}
              {f.required && <span aria-hidden className="text-destructive"> *</span>}
            </Label>
          )
          if (f.type === 'CHECKBOX') {
            return (
              <div key={id} className="flex items-center gap-2">
                <input id={id} type="checkbox" required={f.required} className="size-4 accent-primary" />
                {label}
              </div>
            )
          }
          return (
            <div key={id} className="space-y-1.5">
              {label}
              {f.type === 'TEXTAREA' ? (
                <Textarea id={id} rows={3} required={f.required} placeholder={f.placeholder} />
              ) : f.type === 'SELECT' ? (
                <select id={id} required={f.required} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                  <option value="">{t('preview.choose')}</option>
                  {(f.options ?? []).filter((o) => o.trim()).map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <Input id={id} required={f.required} type={f.type === 'EMAIL' ? 'email' : f.type === 'NUMBER' ? 'number' : f.type === 'DATE' ? 'date' : 'text'} placeholder={f.placeholder} />
              )}
            </div>
          )
        })}
        <Button type="submit" className="self-start" disabled>
          {t('preview.send')}
        </Button>
      </form>
    </section>
  )
}
