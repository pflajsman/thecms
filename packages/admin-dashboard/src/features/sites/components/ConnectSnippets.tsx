import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { publicApiBase } from '@/features/home/home-utils'

function Snippet({ label, code }: { label: string; code: string }) {
  const copy = () => void navigator.clipboard?.writeText(code).then(() => toast.success(`${label} example copied`))
  return (
    <div className="rounded-lg border bg-muted/60">
      <div className="flex items-center justify-between border-b px-3 py-1 text-xs text-muted-foreground">
        <span>{label}</span>
        <Button variant="ghost" size="sm" onClick={copy} aria-label={`Copy ${label} example`}>
          <Copy aria-hidden />
          Copy
        </Button>
      </div>
      <pre aria-label={`${label} example`} className="overflow-x-auto p-3 text-xs">
        <code>{code}</code>
      </pre>
    </div>
  )
}

export function ConnectSnippets({ apiKey, slug }: { apiKey: string; slug?: string }) {
  const url = `${publicApiBase()}/content/${slug ?? 'your-model'}`
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
      <h2 className="font-serif text-lg font-semibold">Connect your site</h2>
      <p className="text-sm text-muted-foreground">Load published entries with this site's API key.</p>
      <Snippet
        label="JavaScript"
        code={`const res = await fetch('${url}', {\n  headers: { 'X-API-Key': '${apiKey}' },\n})\nconst { data } = await res.json()`}
      />
      <Snippet label="curl" code={`curl -H 'X-API-Key: ${apiKey}' '${url}'`} />
    </section>
  )
}
