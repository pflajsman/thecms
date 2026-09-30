import { screen } from '@testing-library/react'
import { Outlet } from 'react-router-dom'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { RouteError } from './RouteError'

function Boom(): never {
  throw new Error('kaboom')
}

it('shows an error inside the layout with ways back', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  renderRoutes(
    [
      {
        element: (
          <div>
            <nav aria-label="Main navigation">shell</nav>
            <Outlet />
          </div>
        ),
        children: [{ errorElement: <RouteError />, children: [{ path: '/broken', element: <Boom /> }] }],
      },
    ],
    { route: '/broken' },
  )
  expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
  expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/')
  expect(screen.getByRole('button', { name: 'Reload page' })).toBeInTheDocument()
})

it('explains a missing page', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  renderRoutes([{ path: '/', element: <p>home</p>, errorElement: <RouteError fullPage /> }], { route: '/nowhere' })
  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
})

it('explains the error in Czech', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await setTestLanguage('cs')
  renderRoutes([{ path: '/', element: <p>home</p>, errorElement: <RouteError fullPage /> }], { route: '/nowhere' })
  expect(await screen.findByRole('heading', { name: 'Stránka nenalezena' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Přejít na Přehled' })).toHaveAttribute('href', '/')
})
