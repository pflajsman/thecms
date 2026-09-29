import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AuthProvider, useAuth } from './AuthContext'

vi.mock('../config/msalConfig', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../config/msalConfig')>()
  return { ...actual, isEntraConfigured: () => false }
})

function Probe({ renders }: { renders: string[] }) {
  const { isAuthenticated, user, logout } = useAuth()
  renders.push(isAuthenticated ? `in:${user?.name}:${localStorage.getItem('auth_token') ? 'stored' : 'missing'}` : 'out')
  return <button onClick={logout}>Sign out</button>
}

beforeEach(() => localStorage.clear())

it('dev auth is signed in on the very first render, with the token already stored', () => {
  const renders: string[] = []
  render(
    <AuthProvider>
      <Probe renders={renders} />
    </AuthProvider>,
  )
  expect(renders[0]).toBe('in:Test Admin:stored')
  expect(renders).not.toContain('out')
})

it('dev sign out clears the stored token', async () => {
  const renders: string[] = []
  const { getByRole } = render(
    <AuthProvider>
      <Probe renders={renders} />
    </AuthProvider>,
  )
  await userEvent.click(getByRole('button', { name: 'Sign out' }))
  expect(renders.at(-1)).toBe('out')
  expect(localStorage.getItem('auth_token')).toBeNull()
})
