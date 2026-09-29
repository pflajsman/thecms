import { AxiosError, AxiosHeaders } from 'axios'
import { apiErrorMessage } from './api-error'

function axiosError(status: number, data: unknown) {
  const headers = new AxiosHeaders()
  return new AxiosError('Request failed', 'ERR', { headers }, null, {
    status, statusText: '', headers, config: { headers }, data,
  })
}

describe('apiErrorMessage', () => {
  it('uses the server error message', () => {
    expect(apiErrorMessage(axiosError(400, { error: 'Validation failed: Title is required' })))
      .toBe('Validation failed: Title is required')
  })
  it('falls back for network errors and unknown values', () => {
    expect(apiErrorMessage(new AxiosError('Network Error'))).toBe('Could not reach the server. Check your connection and try again.')
    expect(apiErrorMessage('boom')).toBe('Something went wrong. Please try again.')
  })

  it('adds the first validation detail', () => {
    expect(apiErrorMessage(axiosError(400, { error: 'Validation error', details: [{ path: ['fields', 0, 'validation', 'minLength'], message: 'Number must be greater than 0' }] })))
      .toBe('Validation error: Number must be greater than 0')
  })
})
