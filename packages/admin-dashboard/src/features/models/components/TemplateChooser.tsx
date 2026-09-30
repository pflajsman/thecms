import { useTranslation } from 'react-i18next'
import { FileText, LayoutTemplate, CalendarDays, Plus } from 'lucide-react'
import { getModelTemplates, type ModelTemplate } from '../templates'

const ICONS = { 'blog-post': FileText, page: LayoutTemplate, event: CalendarDays } as const

export function TemplateChooser({ onChoose }: { onChoose: (t: ModelTemplate | null) => void }) {
  const { t: tr } = useTranslation('models')
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {getModelTemplates().map((t) => {
        const Icon = ICONS[t.id]
        return (
          <li key={t.id}>
            <button type="button" onClick={() => onChoose(t)} className="flex w-full items-start gap-3 rounded-xl border bg-card p-4 text-left hover:bg-accent">
              <Icon aria-hidden className="mt-0.5 size-5 text-primary" />
              <span>
                <span className="block font-serif text-lg font-semibold">{t.name}</span>
                <span className="block text-sm text-muted-foreground">{t.description}</span>
              </span>
            </button>
          </li>
        )
      })}
      <li>
        <button type="button" onClick={() => onChoose(null)} className="flex w-full items-start gap-3 rounded-xl border border-dashed bg-card p-4 text-left hover:bg-accent">
          <Plus aria-hidden className="mt-0.5 size-5 text-muted-foreground" />
          <span>
            <span className="block font-serif text-lg font-semibold">{tr('chooser.scratch')}</span>
            <span className="block text-sm text-muted-foreground">{tr('chooser.scratchText')}</span>
          </span>
        </button>
      </li>
    </ul>
  )
}
