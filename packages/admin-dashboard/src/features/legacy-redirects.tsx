import { Navigate, useParams } from 'react-router-dom'

export function RedirectWithId({ to }: { to: (id: string) => string }) {
  const params = useParams()
  const id = params.id ?? params.formId ?? ''
  return <Navigate to={to(id)} replace />
}
