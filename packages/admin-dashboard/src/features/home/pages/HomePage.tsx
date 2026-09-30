import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Upload } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useStats } from '@/lib/queries/stats'
import { useContentTypes, useEntryList } from '@/features/content/queries'
import { useSites } from '@/features/sites/sites-api'
import { formatNumber, formatRelative } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { getSetupSteps, greeting, readSetupDismissed, writeSetupDismissed } from '../home-utils'
import { SetupChecklist } from '../components/SetupChecklist'
import { useInbox } from '@/features/inbox/inbox-queries'
import { senderName } from '@/features/inbox/inbox-utils'
import { ConnectSnippet } from '../components/ConnectSnippet'

export function HomePage() {
  const { user } = useAuth()
  const { t } = useTranslation('home')
  const stats = useStats()
  const types = useContentTypes()
  const sites = useSites()
  const [dismissed, setDismissed] = useState(readSetupDismissed)
  const drafts = useEntryList({ status: 'DRAFT', sortBy: 'updatedAt', sortOrder: 'desc', limit: 5 })
  const unread = useInbox({ status: 'UNREAD', limit: 3 })

  if (!stats.data) {
    return (
      <div role="status" aria-busy="true" aria-label={t('loading')} className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const steps = getSetupSteps(stats.data)
  if (!dismissed && steps.some((s) => !s.done)) {
    return (
      <SetupChecklist
        steps={steps}
        firstSite={sites.data?.[0]}
        firstType={types.data?.[0]}
        onDismiss={() => {
          writeSetupDismissed()
          setDismissed(true)
        }}
      />
    )
  }

  const s = stats.data
  const dismiss = () => {
    writeSetupDismissed()
    setDismissed(true)
  }
  const firstSite = sites.data?.[0]
  const firstType = types.data?.[0]
  const tiles = [
    { id: 'entries', label: t('tiles.entries', { count: s.entries.total }), value: s.entries.total, to: '/content' },
    { id: 'drafts', label: t('tiles.drafts', { count: s.entries.draft }), value: s.entries.draft, to: '/content?status=DRAFT' },
    { id: 'unread', label: t('tiles.unread', { count: s.submissions.unread }), value: s.submissions.unread, to: '/inbox' },
    { id: 'media', label: t('tiles.media', { count: s.media }), value: s.media, to: '/media' },
  ]

  return (
    <>
      <h1 className="mb-6 font-serif text-3xl font-semibold">{greeting(new Date(), user?.name)}</h1>
      {!dismissed && firstSite && firstType && (
        // The last setup step completes the checklist; keep its payoff (a working snippet) visible until dismissed.
        <section className="mb-6 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-serif text-lg font-semibold">{t('connected.title')}</h2>
            <Button variant="ghost" size="sm" onClick={dismiss}>{t('setup.hide')}</Button>
          </div>
          <p className="text-sm text-muted-foreground">{t('connected.text', { site: firstSite.name, model: firstType.name })}</p>
          <ConnectSnippet apiKey={firstSite.apiKey} slug={firstType.slug} />
        </section>
      )}
      <ul className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((tile) => (
          <li key={tile.id}>
            <Link to={tile.to} className="block rounded-xl border bg-card p-4 hover:bg-accent">
              <span className="block font-serif text-3xl font-semibold">{formatNumber(tile.value)}</span>
              <span className="text-sm text-muted-foreground">{tile.label}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 font-serif text-lg font-semibold">{t('continue.title')}</h2>
          {drafts.isPending ? (
            <Skeleton className="h-20 w-full" />
          ) : (drafts.data?.data.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{t('continue.empty')}</p>
          ) : (
            <ul className="divide-y">
              {drafts.data!.data.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <Link to={`/content/${e.id}`} className="min-w-0 flex-1 truncate font-serif text-base hover:underline">{e.title}</Link>
                  <span className="shrink-0 text-xs text-muted-foreground">{e.contentType?.name} · {formatRelative(e.updatedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-xl border bg-card p-4">
          <h2 className="mb-2 font-serif text-lg font-semibold">{t('inbox.title')}</h2>
          {(unread.data?.data.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">{t('inbox.empty')}</p>
          ) : (
            <ul className="divide-y">
              {unread.data!.data.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <Link to={`/inbox/${m.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{senderName(m)}</Link>
                  <span className="shrink-0 text-xs text-muted-foreground">{m.form?.name ?? ''} · {formatRelative(m.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/inbox">{t('inbox.open')}</Link>
          </Button>
        </section>
      </div>
      <section className="mt-6">
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('create.title')}</h2>
        <div className="flex flex-wrap gap-2">
          {(types.data ?? []).map((type) => (
            <Button key={type.id} asChild variant="outline" size="sm">
              <Link to={`/content/new?type=${type.id}`}>{t('create.newOfType', { model: type.name })}</Link>
            </Button>
          ))}
          <Button asChild variant="outline" size="sm">
            <Link to="/media">
              <Upload aria-hidden />
              {t('create.uploadMedia')}
            </Link>
          </Button>
        </div>
      </section>
    </>
  )
}
