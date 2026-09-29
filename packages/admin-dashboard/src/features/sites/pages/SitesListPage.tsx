import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Eye, EyeOff, KeyRound, Plus, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api-error'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useSites, useSiteWrites, type Site } from '../sites-api'
import { maskKey } from '../sites-utils'

export function SitesListPage() {
  const sites = useSites()
  const action = (
    <Button asChild>
      <Link to="/sites/new">
        <Plus aria-hidden />
        New site
      </Link>
    </Button>
  )
  let body: React.ReactNode
  if (sites.isPending) body = <Skeleton className="h-32 w-full" />
  else if (sites.isError) body = <ErrorState message="Could not load sites." onRetry={() => void sites.refetch()} />
  else if (sites.data.length === 0)
    body = (
      <EmptyState
        icon={KeyRound}
        title="No sites yet"
        description="A site gets an API key your website uses to read published content."
        action={action}
      />
    )
  else
    body = (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2">
        {sites.data.map((s) => (
          <SiteCard key={s.id} site={s} />
        ))}
      </div>
    )
  return (
    <>
      <PageHeader title="Sites & API keys" description="Each website that reads your content has its own key." actions={action} />
      {body}
    </>
  )
}

function SiteCard({ site }: { site: Site }) {
  const writes = useSiteWrites()
  const [revealed, setRevealed] = useState(false)
  const [confirmRotate, setConfirmRotate] = useState(false)
  const rotate = async () => {
    setConfirmRotate(false)
    try {
      await writes.rotate(site.id)
      toast.success('New key created. Update your site with it.')
      setRevealed(true)
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }
  const copy = () => void navigator.clipboard?.writeText(site.apiKey).then(() => toast.success('API key copied'))
  return (
    <article aria-label={site.name} className="flex min-w-0 flex-col gap-3 rounded-xl border bg-card p-4">
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link to={`/sites/${site.id}`} className="font-serif text-lg font-semibold hover:underline">
            {site.name}
          </Link>
          <p className="truncate text-sm text-muted-foreground">{site.domain}</p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-0.5 text-xs',
            site.isActive ? 'bg-status-published-bg text-status-published-fg' : 'bg-status-archived-bg text-status-archived-fg',
          )}
        >
          {site.isActive ? 'Active' : 'Disabled'}
        </span>
      </header>
      <p className="text-sm text-muted-foreground">
        {site.requestCount} requests · {site.lastRequestAt ? `last ${formatRelative(site.lastRequestAt)}` : 'no requests yet'}
      </p>
      <div className="flex items-center gap-1 rounded-lg bg-muted/60 py-1 pr-1 pl-3">
        <code className="min-w-0 flex-1 font-mono text-xs break-all">{revealed ? site.apiKey : maskKey(site.apiKey)}</code>
        <Button variant="ghost" size="icon" aria-label={revealed ? 'Hide API key' : 'Reveal API key'} onClick={() => setRevealed(!revealed)}>
          {revealed ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
        <Button variant="ghost" size="icon" aria-label="Copy API key" onClick={copy}>
          <Copy aria-hidden />
        </Button>
      </div>
      <div>
        <Button variant="outline" size="sm" onClick={() => setConfirmRotate(true)}>
          <RefreshCw aria-hidden />
          Rotate key
        </Button>
      </div>
      <ConfirmDialog
        open={confirmRotate}
        onOpenChange={setConfirmRotate}
        title={`Rotate the key for ${site.name}?`}
        description="The current key stops working immediately. Update your site with the new key right away."
        confirmText={site.name}
        confirmLabel="Rotate key"
        destructive
        onConfirm={() => void rotate()}
      />
    </article>
  )
}
