import { authorizationHeader } from './auth-header'

it('uses the dev token when Entra is not configured', async () => {
  localStorage.setItem('auth_token', 'dev-token')
  expect(await authorizationHeader()).toBe('Bearer dev-token')
  localStorage.removeItem('auth_token')
  expect(await authorizationHeader()).toBeUndefined()
})
