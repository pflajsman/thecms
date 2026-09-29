import { Button } from '@/components/ui/button'

interface PagerProps {
  page: number
  limit: number
  total: number
  onPageChange: (page: number) => void
}

export function Pager({ page, limit, total, onPageChange }: PagerProps) {
  if (total === 0) return null
  const last = Math.max(1, Math.ceil(total / limit))
  const from = Math.min((page - 1) * limit + 1, total)
  const to = Math.min(page * limit, total)
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Previous
        </Button>
        <Button variant="outline" size="sm" disabled={page >= last} onClick={() => onPageChange(page + 1)}>
          Next
        </Button>
      </div>
    </nav>
  )
}
