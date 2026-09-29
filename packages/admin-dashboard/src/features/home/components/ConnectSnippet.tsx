import { Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { publicApiBase } from '../home-utils'

export function ConnectSnippet({ apiKey, slug }: { apiKey: string; slug: string }) {
  const code = `fetch('${publicApiBase()}/content/${slug}', {
  headers: { 'X-API-Key': '${apiKey}' },
})
  .then((res) => res.json())
  .then(({ data }) => console.log(data))`
  return (
    <div className="mt-3 rounded-lg border bg-muted/60">
      <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs text-muted-foreground">
        <span>JavaScript</span>
        <Button variant="ghost" size="sm" onClick={() => void navigator.clipboard?.writeText(code).then(() => toast.success('Snippet copied'))}>
          <Copy aria-hidden />
          Copy
        </Button>
      </div>
      <pre aria-label="Fetch example" className="overflow-x-auto p-3 text-xs"><code>{code}</code></pre>
    </div>
  )
}
