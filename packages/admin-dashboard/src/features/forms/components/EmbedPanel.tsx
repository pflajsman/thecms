import { Trans, useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import type { FormFieldDefinition } from '@/types'
import { Button } from '@/components/ui/button'
import { publicApiBase } from '@/features/home/home-utils'

export function EmbedPanel({ slug, fields, apiKey }: { slug: string; fields: FormFieldDefinition[]; apiKey?: string }) {
  const { t } = useTranslation('forms')
  const key = apiKey ?? 'YOUR_API_KEY'
  const example = Object.fromEntries(fields.map((f) => [f.name, f.type === 'CHECKBOX' ? true : f.type === 'NUMBER' ? 1 : f.type === 'EMAIL' ? 'jana@example.com' : '…']))
  const code = `fetch('${publicApiBase()}/forms/${slug || 'your-form'}/submit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-API-Key': '${key}' },
  body: JSON.stringify(${JSON.stringify(example, null, 2).replace(/\n/g, '\n  ')}),
})`
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="mb-1 font-serif text-lg font-semibold">{t('embed.title')}</h2>
      <p className="mb-2 text-sm text-muted-foreground">
        <Trans t={t} i18nKey="embed.intro" values={{ url: `${publicApiBase()}/forms/${slug || 'your-form'}` }} components={{ code: <code className="font-mono text-xs break-all" /> }} />
      </p>
      <div className="rounded-lg border bg-muted/60">
        <div className="flex items-center justify-end border-b px-2 py-1">
          <Button variant="ghost" size="sm" onClick={() => void navigator.clipboard?.writeText(code).then(() => toast.success(t('embed.copied')))}>
            <Copy aria-hidden />
            {t('actions.copy', { ns: 'common' })}
          </Button>
        </div>
        <pre aria-label={t('embed.exampleLabel')} className="overflow-x-auto p-3 text-xs"><code>{code}</code></pre>
      </div>
      {!apiKey && <p className="mt-2 text-xs text-muted-foreground">{t('embed.noKey')}</p>}
    </section>
  )
}
