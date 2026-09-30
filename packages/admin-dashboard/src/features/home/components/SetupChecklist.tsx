import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import type { ContentType } from '@/types'
import type { Site } from '@/features/sites/sites-api'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SetupStep } from '../home-utils'
import { ConnectSnippet } from './ConnectSnippet'

interface SetupChecklistProps {
  steps: SetupStep[]
  firstSite?: Site
  firstType?: ContentType
  onDismiss: () => void
}

export function SetupChecklist({ steps, firstSite, firstType, onDismiss }: SetupChecklistProps) {
  const nextId = steps.find((s) => !s.done)?.id
  const { t } = useTranslation('home')
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="font-serif text-3xl font-semibold">{t('welcome')}</h1>
          <p className="mt-1 text-muted-foreground">{t('setup.intro')}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss}>{t('setup.hide')}</Button>
      </div>
      <ol aria-label={t('setup.stepsLabel')} className="flex flex-col divide-y rounded-xl border bg-card">
        {steps.map((step, index) => (
          <li key={step.id} className="flex items-start gap-3 p-4">
            <span
              aria-hidden
              className={cn(
                'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-semibold',
                step.done ? 'border-primary bg-primary text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {step.done ? <Check className="size-3.5" /> : index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('font-medium', step.done && 'text-muted-foreground line-through')}>
                {step.title}
                <span className="sr-only">{step.done ? t('setup.done') : ''}</span>
              </p>
              <p className="text-sm text-muted-foreground">{step.description}</p>
              {step.id === 'site' && step.done && firstSite && firstType && <ConnectSnippet apiKey={firstSite.apiKey} slug={firstType.slug} />}
            </div>
            {!step.done && step.to && (
              <Button asChild size="sm" variant={step.id === nextId ? 'default' : 'outline'}>
                <Link to={step.to}>{step.cta}</Link>
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
