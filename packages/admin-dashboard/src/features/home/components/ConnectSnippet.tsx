import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { publicApiBase } from '../home-utils'

export function ConnectSnippet({ apiKey, slug }: { apiKey: string; slug: string }) {
  const { t } = useTranslation('home')
  const code = `fetch('${publicApiBase()}/content/${slug}', {
  headers: { 'X-API-Key': '${apiKey}' },
})
  .then((res) => res.json())
  .then(({ data }) => console.log(data))`
  return (
    <div className="mt-3 rounded-lg border bg-muted/60">
      <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
        <span>{t('snippet.language')}</span>
        <Button variant="ghost" size="sm" onClick={() => void navigator.clipboard?.writeText(code).then(() => toast.success(t('snippet.copied')))}>
          <Copy aria-hidden />
          {t('actions.copy', { ns: 'common' })}
        </Button>
      </div>
      <pre aria-label={t('snippet.fetchExample')} className="overflow-x-auto p-3 text-xs"><code>{code}</code></pre>
    </div>
  )
}
