import { Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from './shell/AppShell'
import { RouteError } from './RouteError'
import { collectRoutes } from '@/modules/nav'
import { modules } from '@/modules/registry'

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <RouteError fullPage />,
    children: [
      {
        // Page errors render here, inside the shell, so navigation stays available.
        errorElement: <RouteError />,
        children: [...collectRoutes(modules), { path: '*', element: <Navigate to="/" replace /> }],
      },
    ],
  },
]
