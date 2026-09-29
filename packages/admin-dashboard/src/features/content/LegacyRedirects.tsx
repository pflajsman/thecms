import { Navigate, useParams, useSearchParams } from 'react-router-dom'

export function LegacyEntriesRedirect() {
  const [params] = useSearchParams()
  const type = params.get('contentType')
  return <Navigate to={type ? `/content?type=${encodeURIComponent(type)}` : '/content'} replace />
}

export function LegacyNewEntryRedirect() {
  const [params] = useSearchParams()
  const type = params.get('contentType')
  return <Navigate to={type ? `/content/new?type=${encodeURIComponent(type)}` : '/content/new'} replace />
}

export function LegacyEditEntryRedirect() {
  const { id } = useParams()
  return <Navigate to={`/content/${id}`} replace />
}
