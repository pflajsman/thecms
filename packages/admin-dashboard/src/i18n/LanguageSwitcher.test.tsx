import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { SignInScreen } from '@/app/shell/SignInScreen'

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ login: vi.fn() }) }))

it('switches the sign-in screen to Czech and back', async () => {
  renderWithProviders(<SignInScreen />)
  expect(screen.getByRole('heading', { name: 'Welcome to TheCMS' })).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('Language'), 'cs')
  expect(screen.getByRole('heading', { name: 'Vítejte v TheCMS' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Přihlásit se' })).toBeInTheDocument()
  expect(screen.getByLabelText('Jazyk')).toHaveValue('cs')
  await userEvent.selectOptions(screen.getByLabelText('Jazyk'), 'en')
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
})
