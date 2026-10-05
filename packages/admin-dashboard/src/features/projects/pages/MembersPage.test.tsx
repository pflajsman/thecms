import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderRoutes, setTestLanguage } from '@/test/render'
import { expectNoA11yViolations } from '@/test/a11y'
import apiClient from '@/lib/api'
import type { Member, ProjectRole } from '../projects-api'
import { ProjectProvider } from '../ProjectContext'
import { MembersPage } from './MembersPage'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

const ok = (data: unknown) => ({ data: { success: true, data } })
let myRole: ProjectRole = 'OWNER'
let members: Member[] = []
let invitations: { id: string; email: string; role: ProjectRole; expiresAt: string; expired: boolean; createdAt: string }[] = []

const routes = [
  {
    path: '/members',
    element: (
      <ProjectProvider loading={null} noProject={() => null}>
        <MembersPage />
      </ProjectProvider>
    ),
  },
  { path: '/', element: <p>home</p> },
]

beforeEach(() => {
  myRole = 'OWNER'
  members = [
    { userId: 'me', email: 'pavel@example.com', displayName: 'Pavel', role: 'OWNER', createdAt: '2026-10-01T00:00:00.000Z' },
    { userId: 'eva', email: 'eva@example.com', displayName: 'Eva', role: 'EDITOR', createdAt: '2026-10-02T00:00:00.000Z' },
    { userId: 'adam', email: 'adam@example.com', displayName: 'Adam', role: 'ADMIN', createdAt: '2026-10-02T00:00:00.000Z' },
  ]
  invitations = []
  vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
    if (url === '/users/me') return ok({ entraId: 'me', email: 'pavel@example.com', isSuperadmin: false, projects: [{ id: 'p1', name: 'Alpha', role: myRole }] })
    if (url === '/members') return ok({ members, invitations })
    throw new Error(`unexpected GET ${url}`)
  })
  vi.mocked(apiClient.patch).mockImplementation(async (url: string, body: unknown) => {
    const id = url.split('/').pop()
    if (url === '/project') return ok({ id: 'p1', name: (body as { name: string }).name, status: 'active' })
    members = members.map((m) => (m.userId === id ? { ...m, role: (body as { role: ProjectRole }).role } : m))
    return { status: 204 }
  })
  vi.mocked(apiClient.delete).mockImplementation(async (url: string) => {
    const id = url.split('/').pop()
    members = members.filter((m) => m.userId !== id)
    invitations = invitations.filter((i) => i.id !== id)
    return { status: 204 }
  })
  vi.mocked(apiClient.post).mockImplementation(async (url: string, body: unknown) => {
    const b = body as { email: string; role: ProjectRole; language: string }
    if (url === '/invitations') {
      const invitation = { id: 'i1', email: b.email, role: b.role, expiresAt: '2026-10-12T00:00:00.000Z', expired: false, createdAt: '2026-10-05T00:00:00.000Z' }
      invitations = [invitation]
      return ok({ invitation, inviteUrl: 'http://admin.test/invite/abc', emailSent: false })
    }
    throw new Error(`unexpected POST ${url}`)
  })
})

it('lists members and invites someone, showing the link when the email cannot be sent', async () => {
  const { container } = renderRoutes(routes, { route: '/members' })
  const list = await screen.findByRole('list', { name: 'Members' })
  expect(within(list).getAllByRole('listitem').map((li) => li.textContent?.split(/(?=[A-Z][a-z]+@)/)[0])).toHaveLength(3)
  expect(screen.getByText('You')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Invite people' }))
  await userEvent.type(screen.getByLabelText('Email'), 'nova@example.com')
  await userEvent.selectOptions(screen.getByLabelText('Role'), 'Viewer')
  await userEvent.click(screen.getByRole('button', { name: 'Send invitation' }))
  expect(await screen.findByText(/could not be sent/)).toBeInTheDocument()
  expect(screen.getByLabelText('Invitation link')).toHaveValue('http://admin.test/invite/abc')
  expect(apiClient.post).toHaveBeenCalledWith('/invitations', { email: 'nova@example.com', role: 'VIEWER', language: 'en' })
  await userEvent.click(screen.getByRole('button', { name: 'Done' }))
  expect(await screen.findByRole('list', { name: 'Open invitations' })).toHaveTextContent('nova@example.com')
  await expectNoA11yViolations(container)
})

it('changes a role and removes a member after confirming', async () => {
  renderRoutes(routes, { route: '/members' })
  await userEvent.selectOptions(await screen.findByLabelText('Role of Eva'), 'Viewer')
  await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/members/eva', { role: 'VIEWER' }))
  expect(await screen.findByText('Eva is now Viewer')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Remove Eva' }))
  await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Remove' }))
  await waitFor(() => expect(screen.queryByLabelText('Role of Eva')).not.toBeInTheDocument())
})

it('lets an Admin manage Editors but not other Admins, and never offers Owner', async () => {
  myRole = 'ADMIN'
  members = members.map((m) => (m.userId === 'me' ? { ...m, role: 'ADMIN' } : m))
  renderRoutes(routes, { route: '/members' })
  const evaRole = await screen.findByLabelText('Role of Eva')
  expect(within(evaRole).queryByRole('option', { name: 'Owner' })).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Role of Adam')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Remove Adam' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Rename project' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Invite people' }))
  expect(within(screen.getByLabelText('Role')).queryByRole('option', { name: 'Owner' })).not.toBeInTheDocument()
})

it('lets the Owner rename the project', async () => {
  renderRoutes(routes, { route: '/members' })
  await userEvent.click(await screen.findByRole('button', { name: 'Rename project' }))
  const input = screen.getByLabelText('Name')
  await userEvent.clear(input)
  await userEvent.type(input, 'Alpha Shop')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith('/project', { name: 'Alpha Shop' }))
})

it('speaks Czech', async () => {
  await setTestLanguage('cs')
  renderRoutes(routes, { route: '/members' })
  expect(await screen.findByRole('heading', { name: 'Členové' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Pozvat lidi' })).toBeInTheDocument()
  expect(await screen.findByText('Vy')).toBeInTheDocument()
})
