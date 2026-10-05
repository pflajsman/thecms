import { authorizationHeader } from './auth-header'

it('uses the dev token when Entra is not configured', async () => {
  localStorage.setItem('auth_token', 'dev-token')
  expect(await authorizationHeader()).toBe('Bearer dev-token')
  localStorage.removeItem('auth_token')
  expect(await authorizationHeader()).toBeUndefined()
})

describe('with Entra', () => {
  const account = { homeAccountId: 'a', username: 'u' }

  async function setup(silent: () => Promise<unknown>) {
    vi.resetModules()
    vi.doMock('../config/msalConfig', () => ({ isEntraConfigured: () => true, loginRequest: { scopes: ['s'] } }))
    const mod = await import('./auth-header')
    const msal = await import('@azure/msal-browser')
    const instance = {
      getActiveAccount: () => account,
      getAllAccounts: () => [account],
      acquireTokenSilent: vi.fn(silent),
      acquireTokenRedirect: vi.fn(() => Promise.resolve()),
      acquireTokenPopup: vi.fn(),
    }
    mod.setMsalInstance(instance as never)
    return { mod, msal, instance }
  }

  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.doUnmock('../config/msalConfig'))

  it('returns the silently acquired token', async () => {
    const { mod } = await setup(() => Promise.resolve({ accessToken: 'tok' }))
    expect(await mod.authorizationHeader()).toBe('Bearer tok')
  })

  it('renews through a redirect, never a popup, when the refresh token has expired', async () => {
    const msal = await import('@azure/msal-browser')
    const { mod, instance } = await setup(() => Promise.reject(new msal.InteractionRequiredAuthError('login_required')))
    expect(await mod.authorizationHeader()).toBeUndefined()
    await mod.authorizationHeader()
    expect(instance.acquireTokenRedirect).toHaveBeenCalledTimes(1)
    expect(instance.acquireTokenPopup).not.toHaveBeenCalled()
  })

  it('does not renew again within a minute of the last renewal', async () => {
    sessionStorage.setItem('auth_renewed_at', String(Date.now()))
    const msal = await import('@azure/msal-browser')
    const { mod, instance } = await setup(() => Promise.reject(new msal.InteractionRequiredAuthError('login_required')))
    await mod.authorizationHeader()
    expect(instance.acquireTokenRedirect).not.toHaveBeenCalled()
  })
})
