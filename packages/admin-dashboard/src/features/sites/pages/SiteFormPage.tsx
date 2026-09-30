import { useState, type KeyboardEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorMessage } from '@/lib/api-error'
import { useUnsavedGuard } from '@/lib/hooks/useUnsavedGuard'
import { stableStringify } from '@/features/content/editor/useEntryForm'
import { UnsavedChangesDialog } from '@/features/content/editor/UnsavedChangesDialog'
import { useContentTypes } from '@/features/content/queries'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/ErrorState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { useSite, useSiteWrites, type Site } from '../sites-api'
import { normalizeOrigin, originError, validateSite, type SitePayload } from '../sites-utils'
import { ConnectSnippets } from '../components/ConnectSnippets'

const EMPTY: SitePayload = { name: '', domain: '', description: '', allowedOrigins: [], isActive: true }

export function SiteFormPage() {
  const { id = 'new' } = useParams()
  const siteQuery = useSite(id === 'new' ? undefined : id)
  if (id === 'new') return <SiteForm key="new" initial={EMPTY} />
  if (siteQuery.isError) return <ErrorState message="Could not load this site." onRetry={() => void siteQuery.refetch()} />
  if (!siteQuery.data) return <Skeleton className="h-64 w-full" />
  const s = siteQuery.data
  return (
    <SiteForm
      key={s.id}
      site={s}
      initial={{ name: s.name, domain: s.domain, description: s.description ?? '', allowedOrigins: s.allowedOrigins ?? [], isActive: s.isActive }}
    />
  )
}

function SiteForm({ site, initial }: { site?: Site; initial: SitePayload }) {
  const navigate = useNavigate()
  const writes = useSiteWrites()
  const types = useContentTypes()
  const [draft, setDraft] = useState(initial)
  const [baseline, setBaseline] = useState(() => stableStringify(initial))
  const [origin, setOrigin] = useState('')
  const [originMessage, setOriginMessage] = useState<string | null>(null)
  const [showErrors, setShowErrors] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const errors = validateSite(draft)
  const visible = showErrors ? errors : {}
  const pendingOrigin = origin.trim() !== ''
  const dirty = stableStringify(draft) !== baseline || pendingOrigin
  const blocker = useUnsavedGuard(dirty)

  const addOrigin = () => {
    const message = originError(origin, draft.allowedOrigins)
    setOriginMessage(message)
    if (message) return
    setDraft({ ...draft, allowedOrigins: [...draft.allowedOrigins, normalizeOrigin(origin)] })
    setOrigin('')
  }
  const onOriginKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addOrigin()
    }
  }

  const save = async () => {
    setShowErrors(true)
    // An origin typed but not added yet would otherwise be dropped, leaving the key open to every origin.
    let allowedOrigins = draft.allowedOrigins
    if (pendingOrigin) {
      const message = originError(origin, allowedOrigins)
      setOriginMessage(message)
      if (message) {
        toast.error('Fix the highlighted fields before saving')
        return
      }
      allowedOrigins = [...allowedOrigins, normalizeOrigin(origin)]
    }
    if (Object.keys(errors).length) {
      toast.error('Fix the highlighted fields before saving')
      return
    }
    const next = { ...draft, allowedOrigins }
    const payload = { ...next, name: draft.name.trim(), domain: draft.domain.trim().toLowerCase(), description: draft.description?.trim() }
    try {
      const saved = site ? await writes.update(site.id, payload) : await writes.create(payload)
      setDraft(next)
      setOrigin('')
      setBaseline(stableStringify(next))
      toast.success(site ? 'Site saved' : 'Site created')
      if (!site) navigate(`/sites/${saved.id}`, { replace: true, state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  const remove = async () => {
    setConfirmDelete(false)
    try {
      await writes.remove(site!.id)
      toast.success(`Deleted ${site!.name}`)
      navigate('/sites', { state: { skipGuard: true } })
    } catch (error) {
      toast.error(apiErrorMessage(error))
    }
  }

  return (
    <>
      <PageHeader
        title={draft.name.trim() || 'New site'}
        breadcrumb={<Link to="/sites">Sites & API keys</Link>}
        actions={
          <>
            {site && (
              <Button variant="outline" onClick={() => setConfirmDelete(true)}>
                Delete site
              </Button>
            )}
            <Button onClick={() => void save()} disabled={!!site && !dirty}>
              Save site
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4">
          <div className="space-y-1.5">
            <Label htmlFor="site-name">Name</Label>
            <Input
              id="site-name"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              aria-invalid={visible.name ? true : undefined}
            />
            {visible.name && <p className="text-sm text-destructive">{visible.name}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-domain">Domain</Label>
            <Input
              id="site-domain"
              value={draft.domain}
              placeholder="example.com"
              onChange={(e) => setDraft({ ...draft, domain: e.target.value })}
              aria-invalid={visible.domain ? true : undefined}
            />
            {visible.domain && <p className="text-sm text-destructive">{visible.domain}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-description">Description</Label>
            <Textarea id="site-description" rows={2} value={draft.description ?? ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="site-origin">Add allowed origin</Label>
            <div className="flex gap-2">
              <Input
                id="site-origin"
                value={origin}
                placeholder="https://example.com"
                onChange={(e) => setOrigin(e.target.value)}
                onKeyDown={onOriginKey}
                aria-invalid={originMessage ? true : undefined}
              />
              <Button type="button" variant="outline" onClick={addOrigin}>
                Add
              </Button>
            </div>
            {(originMessage || visible.allowedOrigins) && <p className="text-sm text-destructive">{originMessage ?? visible.allowedOrigins}</p>}
            <p className="text-xs text-muted-foreground">Browsers on these origins may call the API with this key. Leave empty to allow any.</p>
            {draft.allowedOrigins.length > 0 && (
              <ul className="flex flex-wrap gap-1.5">
                {draft.allowedOrigins.map((o) => (
                  <li key={o} className="inline-flex max-w-full items-center gap-1 rounded-full border bg-background py-0.5 pr-1 pl-3 text-sm">
                    <span className="break-all">{o}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${o}`}
                      className="rounded-full p-1 hover:bg-accent"
                      onClick={() => setDraft({ ...draft, allowedOrigins: draft.allowedOrigins.filter((x) => x !== o) })}
                    >
                      <X aria-hidden className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* New sites are always created active (the create endpoint has no isActive). */}
          {site && (
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="site-active">Active</Label>
              <Switch id="site-active" checked={draft.isActive !== false} onCheckedChange={(checked) => setDraft({ ...draft, isActive: checked })} />
            </div>
          )}
        </section>
        {site && <ConnectSnippets apiKey={site.apiKey} slug={types.data?.[0]?.slug} />}
      </div>
      <UnsavedChangesDialog blocker={blocker} />
      {site && (
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={`Delete ${site.name}?`}
          description="Its API key stops working immediately."
          confirmText={site.name}
          confirmLabel="Delete"
          destructive
          onConfirm={() => void remove()}
        />
      )}
    </>
  )
}
