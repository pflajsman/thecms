import { Navigate, type RouteObject } from 'react-router-dom'
import { AppShell } from './shell/AppShell'
import { collectRoutes } from '@/modules/nav'
import { modules } from '@/modules/registry'

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [...collectRoutes(modules), { path: '*', element: <Navigate to="/" replace /> }],
  },
]
