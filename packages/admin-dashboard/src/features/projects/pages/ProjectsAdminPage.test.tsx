import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import type { ProjectSummary } from '../projects-api'
import { ProjectProvider } from '../ProjectContext'
import { ProjectsAdminPage } from './ProjectsAdminPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

const ok = (data: unknown) => ({ data: { success: true, data } })
let projects: ProjectSummary[] = []

const routes = [
  { path: '/admin/projects', element: <ProjectProvider loading={null} noProject={() => null}><ProjectsAdminPage /></ProjectProvider> },
  { path: '/', element: <ProjectProvider loading={null} noProject={() => null}><p>home</p></ProjectProvider> },
]

beforeEach(() => {
  localStorage.removeItem('current_project')
  projects = [{ id: 'p1', name: 'Default', status: 'active', createdAt: '2026-10-01T00:00:00.000Z', memberCount: 3 }]
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/users/me') {
      return ok({ entraId: 'root', email: 'root@example.com', isSuperadmin: true, projects: projects.filter((p) => p.status === 'active').map((p) => ({ id: p.id, name: p.name, role: 'OWNER' })) })
    }
    if (url === '/projects') return ok(projects)
    throw new Error(`unexpected GET ${url}`)
  })
  vi.mocked(apiClient.post).mockImplementation(async (_url: string, body: unknown) => {
    const b = body as { name: string; ownerEmail: string }
    const project = { id: 'p2', name: b.name, status: 'active' as const, createdAt: '2026-10-05T00:00:00.000Z', memberCount: 0 }
    projects = [...projects, project]
    return ok({ project, invitation: { id: 'i1', email: b.ownerEmail, role: 'OWNER', expiresAt: '2026-10-12T00:00:00.000Z', expired: false, createdAt: '2026-10-05T00:00:00.000Z' }, inviteUrl: 'http://admin.test/invite/xyz', emailSent: true })
  })
  vi.mocked(apiClient.patch).mockImplementation(async (url: string, body: unknown) => {
    const id = url.split('/').pop()
    projects = projects.map((p) => (p.id === id ? { ...p, ...(body as object) } : p))
    return ok(projects.find((p) => p.id === id))
  })
})

it('creates a project and invites its owner', async () => {
  const { container } = renderRoutes(routes, { route: '/admin/projects' })
  expect(await screen.findByText('3 members')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'New project' }))
  await userEvent.type(screen.getByLabelText('Project name'), 'Client shop')
  await userEvent.type(screen.getByLabelText("Owner's email"), 'owner@client.com')
  await userEvent.click(screen.getByRole('button', { name: 'Create project' }))
  expect(await screen.findByText('We emailed the link to owner@client.com.')).toBeInTheDocument()
  expect(apiClient.post).toHaveBeenCalledWith('/projects', { name: 'Client shop', ownerEmail: 'owner@client.com', language: 'en' })
  await userEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(await screen.findByText('Client shop')).toBeInTheDocument()
  await expectNoA11yViolations(container)
})

it('archives a project and opens another one', async () => {
  projects.push({ id: 'p2', name: 'Client', status: 'active', createdAt: '2026-10-05T00:00:00.000Z', memberCount: 1 })
  const { router } = renderRoutes(routes, { route: '/admin/projects' })
  const list = await screen.findByRole('list', { name: 'Projects' })
  await userEvent.click(within(list).getByRole('button', { name: 'Actions for Client' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Archive' }))
  await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/projects/p2', { status: 'archived' }))
  expect(await screen.findByText('Archived')).toBeInTheDocument()

  await userEvent.click(within(list).getByRole('button', { name: 'Actions for Client' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Restore' }))
  await userEvent.click(await within(list).findByRole('button', { name: 'Open' }))
  await waitFor(() => expect(router.state.location.pathname).toBe('/'))
  expect(localStorage.getItem('current_project')).toBe('p2')
})

it('speaks Czech', async () => {
  await setTestLanguage('cs')
  renderRoutes(routes, { route: '/admin/projects' })
  expect(await screen.findByRole('heading', { name: 'Projekty' })).toBeInTheDocument()
  expect(await screen.findByText('3 členové')).toBeInTheDocument()
})
