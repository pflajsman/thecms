import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface DataColumn<T> {
  id: string
  header: string
  cell: (row: T) => ReactNode
  className?: string
}

interface DataListProps<T> {
  rows: T[]
  columns: DataColumn<T>[]
  rowKey: (row: T) => string
  /** Card rendered below the md breakpoint. */
  mobileRow: (row: T) => ReactNode
  /** Accessible name of the table. */
  caption: string
}

/** A table on desktop, a list of cards on mobile. */
export function DataList<T>({ rows, columns, rowKey, mobileRow, caption }: DataListProps<T>) {
  return (
    <>
      <table aria-label={caption} className="hidden w-full border-separate border-spacing-y-1.5 text-sm md:table">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            {columns.map((c) => (
              <th key={c.id} scope="col" className={cn('px-3 pb-1 font-medium', c.className)}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} className="bg-card shadow-[0_0_0_1px_var(--border)] [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg">
              {columns.map((c) => (
                <td key={c.id} className={cn('px-3 py-2.5 align-middle', c.className)}>
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <ul aria-label={caption} className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-lg border bg-card p-3">
            {mobileRow(row)}
          </li>
        ))}
      </ul>
    </>
  )
}
