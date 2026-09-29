import { Link } from 'react-router-dom'
import { Boxes } from 'lucide-react'
import type { ContentType } from '@/types'
import { EmptyState } from '@/components/common/EmptyState'
import { Button } from '@/components/ui/button'

interface TypeChooserProps {
  types: ContentType[]
  onChoose?: () => void
}

export function TypeChooser({ types, onChoose }: TypeChooserProps) {
  if (types.length === 0) {
    return (
      <EmptyState
        icon={Boxes}
        title="Create a content model first"
        description="Content models define the fields your entries have."
        action={<Button asChild><Link to="/models">Create a content model</Link></Button>}
      />
    )
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {types.map((t) => (
        <li key={t.id}>
          <Link
            to={`/content/new?type=${t.id}`}
            onClick={onChoose}
            className="flex flex-col rounded-lg border bg-card p-3 hover:bg-accent focus-visible:outline-2"
          >
            <span className="font-serif text-base font-semibold">{t.name}</span>
            <span className="text-xs text-muted-foreground">
              {t.description || `${t.fields.length} field${t.fields.length === 1 ? '' : 's'}`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
