import { Link, isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function RouteError({ fullPage = false }: { fullPage?: boolean }) {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  return (
    <div role="alert" className={cn('flex flex-col items-center px-6 py-16 text-center', fullPage && 'min-h-dvh justify-center bg-background')}>
      <AlertTriangle aria-hidden className="mb-3 size-10 text-destructive" />
      <h1 className="font-serif text-2xl font-semibold">{notFound ? 'Page not found' : 'Something went wrong'}</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        {notFound ? 'The page you asked for does not exist.' : 'This page hit an unexpected error. Your saved content is safe.'}
      </p>
      <div className="mt-6 flex gap-2">
        <Button asChild variant="outline">
          <Link to="/">Go to Home</Link>
        </Button>
        {!notFound && <Button onClick={() => window.location.reload()}>Reload page</Button>}
      </div>
    </div>
  )
}
