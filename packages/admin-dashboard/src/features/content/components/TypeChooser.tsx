import { useTranslation } from 'react-i18next'
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
  const { t } = useTranslation('content')
  if (types.length === 0) {
    return (
      <EmptyState
        icon={Boxes}
        title={t('typeChooser.firstTitle')}
        description={t('typeChooser.firstText')}
        action={<Button asChild><Link to="/models">{t('typeChooser.createModel')}</Link></Button>}
      />
    )
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {types.map((type) => (
        <li key={type.id}>
          <Link
            to={`/content/new?type=${type.id}`}
            onClick={onChoose}
            className="flex flex-col rounded-lg border bg-card p-3 hover:bg-accent focus-visible:outline-2"
          >
            <span className="font-serif text-base font-semibold">{type.name}</span>
            <span className="text-xs text-muted-foreground">
              {type.description || t('typeChooser.fieldCount', { count: type.fields.length })}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
