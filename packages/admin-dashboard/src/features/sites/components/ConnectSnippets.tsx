import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { publicApiBase } from '@/features/home/home-utils'

function Snippet({ label, code }: { label: string; code: string }) {
  const { t } = useTranslation('sites')
  const copy = () => void navigator.clipboard?.writeText(code).then(() => toast.success(t('connect.copied', { label })))
  return (
    <div className="rounded-lg border bg-muted/60">
      <div className="flex items-center justify-between border-b px-3 py-1 text-xs text-muted-foreground">
        <span>{label}</span>
        <Button variant="ghost" size="sm" onClick={copy} aria-label={t('connect.copyExample', { label })}>
          <Copy aria-hidden />
          {t('actions.copy', { ns: 'common' })}
        </Button>
      </div>
      <pre aria-label={t('connect.example', { label })} className="overflow-x-auto p-3 text-xs">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function ConnectSnippets({ apiKey, slug }: { apiKey: string; slug?: string }) {
  const { t } = useTranslation('sites')
  const url = `${publicApiBase()}/content/${slug ?? 'your-model'}`
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 className="font-serif text-lg font-semibold">{t('connect.title')}</h2>
      <p className="text-sm text-muted-foreground">{t('connect.text')}</p>
      <Snippet
        label={t('connect.langJs')}
        code={`const res = await fetch('${url}', {\n  headers: { 'X-API-Key': '${apiKey}' },\n})\nconst { data } = await res.json()`}
      />
      <Snippet label={t('connect.langCurl')} code={`curl -H 'X-API-Key: ${apiKey}' '${url}'`} />
    </section>
  )
}
