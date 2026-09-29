import { FileText, LayoutTemplate, CalendarDays, Plus } from 'lucide-react'
import { MODEL_TEMPLATES, type ModelTemplate } from '../templates'

const ICONS = { 'blog-post': FileText, page: LayoutTemplate, event: CalendarDays } as const

export function TemplateChooser({ onChoose }: { onChoose: (t: ModelTemplate | null) => void }) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {MODEL_TEMPLATES.map((t) => {
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
            <span className="block font-serif text-lg font-semibold">Start from scratch</span>
            <span className="block text-sm text-muted-foreground">Add your own fields.</span>
          </span>
        </button>
      </li>
    </ul>
  )
}
