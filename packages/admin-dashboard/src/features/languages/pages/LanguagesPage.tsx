import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { MoreHorizontal, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/ErrorState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { apiErrorMessage } from '@/lib/api-error'
import { useEntryList } from '@/features/content/queries'
import type { Language } from '../languages-api'
import { useLanguages, useLanguageWrites } from '../languages-queries'
import { LanguageFormDialog } from '../components/LanguageFormDialog'

type Dialog = { kind: 'add' } | { kind: 'rename' | 'default' | 'delete'; language: Language } | null

export function LanguagesPage() {
  const { t } = useTranslation('languages')
  const languages = useLanguages()
  const writes = useLanguageWrites()
  const [dialog, setDialog] = useState<Dialog>(null)
  const [pending, setPending] = useState(false)
  const deleting = dialog?.kind === 'delete' ? dialog.language : undefined
  // Versions that go with the language, shown before confirming.
  const versions = useEntryList({ language: deleting?.code, limit: 1 }, { enabled: !!deleting })

  const run = async (work: () => Promise<string>) => {
    setPending(true)
    try {
      toast.success(await work())
      setDialog(null)
    } catch (error) {
      toast.error(apiErrorMessage(error))
    } finally {
      setPending(false)
    }
  }

  const addButton = (
    <Button onClick={() => setDialog({ kind: 'add' })}>
      <Plus aria-hidden />
      {t('page.add')}
    </Button>
  )

  let body: React.ReactNode
  if (languages.isPending) body = <Skeleton className="h-32 w-full" />
  else if (languages.isError) body = <ErrorState message={t('page.loadError')} onRetry={() => void languages.refetch()} />
  else
    body = (
      <ul aria-label={t('page.tableLabel')} className="flex flex-col divide-y rounded-xl border bg-card">
        {languages.data.map((l) => (
          <li key={l.id} className="flex items-center gap-3 px-4 py-3">
            <span className="w-14 shrink-0 font-mono text-sm text-muted-foreground">{l.code}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{l.name}</span>
            {l.isDefault && <Badge variant="secondary">{t('default')}</Badge>}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label={t('menu.actionsFor', { name: l.name })}>
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setDialog({ kind: 'rename', language: l })}>{t('menu.rename')}</DropdownMenuItem>
                {!l.isDefault && (
                  <>
                    <DropdownMenuItem onSelect={() => setDialog({ kind: 'default', language: l })}>{t('menu.makeDefault')}</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDialog({ kind: 'delete', language: l })}>
                      {t('menu.delete')}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
    )

  const count = versions.data?.pagination.total
  return (
    <>
      <PageHeader title={t('page.title')} description={t('page.description')} actions={addButton} />
      {body}
      <LanguageFormDialog
        open={dialog?.kind === 'add' || dialog?.kind === 'rename'}
        onOpenChange={(o) => !o && setDialog(null)}
        language={dialog?.kind === 'rename' ? dialog.language : undefined}
        pending={pending}
        onSubmit={({ code, name }) =>
          void run(async () => {
            if (dialog?.kind === 'rename') {
              await writes.rename(code, name)
              return t('toast.renamed', { name })
            }
            await writes.create({ code, name })
            return t('toast.added', { name })
          })
        }
      />
      {dialog?.kind === 'default' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={t('confirm.defaultTitle', { name: dialog.language.name })}
          description={t('confirm.defaultText', { name: dialog.language.name })}
          confirmLabel={t('confirm.defaultConfirm')}
          pending={pending}
          onConfirm={() => void run(async () => {
            await writes.makeDefault(dialog.language.code)
            return t('toast.madeDefault', { name: dialog.language.name })
          })}
        />
      )}
      {deleting && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={t('confirm.deleteTitle', { name: deleting.name })}
          description={count === undefined ? '' : count === 0 ? t('confirm.deleteNone', { name: deleting.name }) : t('confirm.deleteText', { count, name: deleting.name })}
          confirmLabel={t('menu.delete')}
          destructive
          confirmText={deleting.code}
          pending={pending}
          onConfirm={() => void run(async () => {
            await writes.remove(deleting.code)
            return t('toast.deleted', { name: deleting.name })
          })}
        />
      )}
    </>
  )
}
