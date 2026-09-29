import { screen } from '@testing-library/react'
import { renderRoutes } from '@/test/render'
import * as contentApi from '@/features/content/content-api'
import { tripType } from '@/features/content/test-fixtures'
import { ModelsListPage } from './ModelsListPage'

vi.mock('@/features/content/content-api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/content/content-api')>()
  return { ...actual, listContentTypes: vi.fn() }
})
vi.mock('@/lib/queries/stats', () => ({
  statsKeys: { all: ['stats'] },
  useStats: () => ({ data: { entries: { byType: { [tripType.id]: 8 } } } }),
  useUnreadCount: () => 0,
}))

it('lists models with field and entry counts', async () => {
  vi.mocked(contentApi.listContentTypes).mockResolvedValue([tripType])
  renderRoutes([{ path: '/models', element: <ModelsListPage /> }], { route: '/models' })
  expect(await screen.findByRole('link', { name: /Trip/ })).toHaveAttribute('href', `/models/${tripType.id}`)
  expect(screen.getByText('3 fields · 8 entries')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'New model' })).toHaveAttribute('href', '/models/new')
})

it('shows an empty state that starts from templates', async () => {
  vi.mocked(contentApi.listContentTypes).mockResolvedValue([])
  renderRoutes([{ path: '/models', element: <ModelsListPage /> }], { route: '/models' })
  expect(await screen.findByText('No content models yet')).toBeInTheDocument()
})
