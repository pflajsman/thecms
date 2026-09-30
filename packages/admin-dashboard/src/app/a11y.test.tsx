import type { ReactElement } from 'react'
import { screen, waitFor } from '@testing-library/react'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { setViewport } from '@/test/viewport'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import { sitesService } from '@/services/sites'
import { makeListItem, page, tripType } from '@/features/content/test-fixtures'
import { makeMedia, mediaPage } from '@/features/media/test-fixtures'
import { ContentListPage } from '@/features/content/pages/ContentListPage'
import { MediaLibraryPage } from '@/features/media/pages/MediaLibraryPage'
import { InboxPage } from '@/features/inbox/pages/InboxPage'
import { ModelsListPage } from '@/features/models/pages/ModelsListPage'
import { FormBuilderPage } from '@/features/forms/pages/FormBuilderPage'
import { SitesListPage } from '@/features/sites/pages/SitesListPage'
import { SiteFormPage } from '@/features/sites/pages/SiteFormPage'
import { WebhooksListPage } from '@/features/webhooks/pages/WebhooksListPage'
import { WebhookFormPage } from '@/features/webhooks/pages/WebhookFormPage'
import { SignInScreen } from '@/app/shell/SignInScreen'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
vi.mock('@/services/sites', () => ({ sitesService: { list: vi.fn(), getById: vi.fn() } }))
vi.mock('@/lib/queries/stats', () => ({
  statsKeys: { all: ['stats'] },
  useStats: () => ({
    data: { entries: { total: 1, draft: 1, published: 0, archived: 0, byType: { [tripType.id]: 1 } }, contentTypes: 1, media: 1, sites: 1, submissions: { unread: 0 } },
  }),
  useUnreadCount: () => 0,
}))
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Pavel', email: 'p@x.test' }, login: vi.fn(), logout: vi.fn(), isAuthenticated: true, isLoading: false }),
}))

const site = { id: 's1', name: 'Blog', domain: 'blog.test', apiKey: 'cms_key_1234567890', allowedOrigins: ['https://blog.test'], isActive: true, requestCount: 1, createdAt: '', updatedAt: '' }
const form = {
  id: 'f1', name: 'Contact', slug: 'contact', recipientEmail: 'me@x.test', isActive: true, submissionCount: 0, createdAt: '', updatedAt: '',
  fields: [{ name: 'email', label: 'Email', type: 'EMAIL', required: true }],
}
const hook = {
  id: 'w1', name: 'Deploy', url: 'https://example.com/hook', events: ['entry.published'], isActive: true, secretPreview: 'whsec_ab...',
  totalDeliveries: 0, successfulDeliveries: 0, failedDeliveries: 0, createdAt: '', updatedAt: '',
}

beforeEach(() => {
  setViewport(true)
  vi.mocked(sitesService.list).mockResolvedValue({ success: true, data: [site], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } })
  vi.mocked(sitesService.getById).mockResolvedValue({ success: true, data: site })
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    const ok = (data: unknown) => ({ data: { success: true, data, pagination: { page: 1, limit: 20, total: Array.isArray(data) ? data.length : 1, totalPages: 1 } } })
    if (url === '/entries') return { data: page([makeListItem()]) }
    if (url === '/content-types') return ok([tripType])
    if (url === '/media') return { data: mediaPage([makeMedia()]) }
    if (url === '/contact-forms') return ok([form])
    if (url === '/contact-forms/f1') return ok(form)
    if (url === '/webhooks') return ok([hook])
    if (url === '/webhooks/w1') return ok(hook)
    return ok([])
  })
})

const cases: [string, string, ReactElement, string][] = [
  ['/content', '/content', <ContentListPage />, 'Content'],
  ['/media', '/media', <MediaLibraryPage />, 'Media'],
  ['/inbox', '/inbox', <InboxPage />, 'Inbox'],
  ['/models', '/models', <ModelsListPage />, 'Content models'],
  ['/forms/:id', '/forms/f1', <FormBuilderPage />, 'Contact'],
  ['/sites', '/sites', <SitesListPage />, 'Sites & API keys'],
  ['/sites/:id', '/sites/s1', <SiteFormPage />, 'Blog'],
  ['/webhooks', '/webhooks', <WebhooksListPage />, 'Webhooks'],
  ['/webhooks/:id', '/webhooks/w1', <WebhookFormPage />, 'Deploy'],
]

it.each(cases)('%s has no axe violations', async (path, url, element, heading) => {
  const { container } = renderRoutes([{ path, element }], { route: url })
  await screen.findByRole('heading', { level: 1, name: heading })
  await expectNoA11yViolations(container)
  // Scan again once loading placeholders are gone, so the loaded page is checked too.
  await waitFor(() => expect(container.querySelector('[aria-busy="true"], [data-slot="skeleton"]')).toBeNull())
  await expectNoA11yViolations(container)
})

it('sign-in screen has no axe violations', async () => {
  const { container } = renderRoutes([{ path: '/', element: <SignInScreen /> }])
  await expectNoA11yViolations(container)
})

describe('in Czech', () => {
  it('/content has no axe violations and the page language is Czech', async () => {
    await setTestLanguage('cs')
    const { container } = renderRoutes([{ path: '/content', element: <ContentListPage /> }], { route: '/content' })
    await screen.findByRole('heading', { level: 1, name: 'Obsah' })
    await waitFor(() => expect(container.querySelector('[aria-busy="true"], [data-slot="skeleton"]')).toBeNull())
    await expectNoA11yViolations(container)
    expect(document.documentElement.lang).toBe('cs')
  })

  const csCases: [string, string, ReactElement, string][] = [
    ['/media', '/media', <MediaLibraryPage />, 'Média'],
    ['/inbox', '/inbox', <InboxPage />, 'Zprávy'],
    ['/models', '/models', <ModelsListPage />, 'Modely obsahu'],
    ['/forms/:id', '/forms/f1', <FormBuilderPage />, 'Contact'],
    ['/sites', '/sites', <SitesListPage />, 'Weby a API klíče'],
    ['/sites/:id', '/sites/s1', <SiteFormPage />, 'Blog'],
    ['/webhooks', '/webhooks', <WebhooksListPage />, 'Webhooky'],
    ['/webhooks/:id', '/webhooks/w1', <WebhookFormPage />, 'Deploy'],
  ]

  it.each(csCases)('%s has no axe violations in Czech', async (path, url, element, heading) => {
    await setTestLanguage('cs')
    const { container } = renderRoutes([{ path, element }], { route: url })
    await screen.findByRole('heading', { level: 1, name: heading })
    await waitFor(() => expect(container.querySelector('[aria-busy="true"], [data-slot="skeleton"]')).toBeNull())
    await expectNoA11yViolations(container)
  })

  it('sign-in screen has no axe violations in Czech', async () => {
    await setTestLanguage('cs')
    const { container } = renderRoutes([{ path: '/', element: <SignInScreen /> }])
    await screen.findByRole('heading', { name: 'Vítejte v TheCMS' })
    await expectNoA11yViolations(container)
    expect(document.documentElement.lang).toBe('cs')
  })
})
