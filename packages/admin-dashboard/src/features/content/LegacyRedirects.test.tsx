import { screen } from '@testing-library/react'
import { useLocation } from 'react-router-dom'
import { renderRoutes } from '@/test/render'
import { LegacyEditEntryRedirect, LegacyEntriesRedirect, LegacyNewEntryRedirect } from './LegacyRedirects'

function Where() {
  const l = useLocation()
  return <p data-testid="where">{l.pathname + l.search}</p>
}

const routes = [
  { path: '/entries', element: <LegacyEntriesRedirect /> },
  { path: '/entries/new', element: <LegacyNewEntryRedirect /> },
  { path: '/entries/:id/edit', element: <LegacyEditEntryRedirect /> },
  { path: '*', element: <Where /> },
]

it.each([
  ['/entries?contentType=abc', '/content?type=abc'],
  ['/entries', '/content'],
  ['/entries/new?contentType=abc', '/content/new?type=abc'],
  ['/entries/e1/edit', '/content/e1'],
])('%s redirects to %s', async (from, to) => {
  renderRoutes(routes, { route: from })
  expect(await screen.findByTestId('where')).toHaveTextContent(to)
})
