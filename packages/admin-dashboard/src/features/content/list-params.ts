import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { EntryStatus } from '@/types'
import type { EntryListParams } from './content-api'

export type ContentSort = 'updatedAt' | 'createdAt' | 'title'

export interface ContentListParams {
  type?: string
  status?: EntryStatus
  q?: string
  sort: ContentSort
  page: number
}

export const PAGE_SIZE = 20
const STATUSES: EntryStatus[] = ['DRAFT', 'PUBLISHED', 'ARCHIVED']
const SORTS: ContentSort[] = ['updatedAt', 'createdAt', 'title']
const OBJECT_ID = /^[a-f0-9]{24}$/i

export function parseListParams(sp: URLSearchParams): ContentListParams {
  const params: ContentListParams = { sort: 'updatedAt', page: 1 }
  const type = sp.get('type')
  if (type && OBJECT_ID.test(type)) params.type = type
  const status = sp.get('status') as EntryStatus | null
  if (status && STATUSES.includes(status)) params.status = status
  const q = sp.get('q')?.trim()
  if (q) params.q = q.slice(0, 100)
  const sort = sp.get('sort') as ContentSort | null
  if (sort && SORTS.includes(sort)) params.sort = sort
  const pageNo = Number(sp.get('page'))
  if (Number.isInteger(pageNo) && pageNo > 1) params.page = pageNo
  return params
}

export function serializeListParams(p: ContentListParams): URLSearchParams {
  const sp = new URLSearchParams()
  if (p.type) sp.set('type', p.type)
  if (p.status) sp.set('status', p.status)
  if (p.q) sp.set('q', p.q)
  if (p.sort !== 'updatedAt') sp.set('sort', p.sort)
  if (p.page > 1) sp.set('page', String(p.page))
  return sp
}

export function toEntryQuery(p: ContentListParams): EntryListParams {
  return {
    contentTypeId: p.type,
    status: p.status,
    search: p.q,
    sortBy: p.sort,
    sortOrder: p.sort === 'title' ? 'asc' : 'desc',
    page: p.page,
    limit: PAGE_SIZE,
  }
}

export function useContentListParams() {
  const [searchParams, setSearchParams] = useSearchParams()
  const params = useMemo(() => parseListParams(searchParams), [searchParams])
  const update = useCallback(
    (patch: Partial<ContentListParams>) => {
      const next: ContentListParams = { ...params, ...patch, page: patch.page ?? 1 }
      setSearchParams(serializeListParams(next), { replace: true })
    },
    [params, setSearchParams],
  )
  return [params, update] as const
}
