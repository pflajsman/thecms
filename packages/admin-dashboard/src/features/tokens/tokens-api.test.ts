import apiClient from '@/lib/api'
import { createToken, listTokens, mcpCommand, revokeToken } from './tokens-api'

vi.mock('@/lib/api', () => ({ default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

it('lists, creates and revokes through the tokens endpoints', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ data: { success: true, data: [{ id: 't1' }] } })
  vi.mocked(apiClient.post).mockResolvedValue({ data: { success: true, data: { id: 't2', token: 'tcms_pat_x' } } })
  vi.mocked(apiClient.delete).mockResolvedValue({ status: 204 })
  expect(await listTokens()).toEqual([{ id: 't1' }])
  expect(apiClient.get).toHaveBeenCalledWith('/tokens')
  expect(await createToken({ name: 'Laptop', expiresInDays: 90 })).toEqual({ id: 't2', token: 'tcms_pat_x' })
  expect(apiClient.post).toHaveBeenCalledWith('/tokens', { name: 'Laptop', expiresInDays: 90 })
  await revokeToken('t1')
  expect(apiClient.delete).toHaveBeenCalledWith('/tokens/t1')
})

it('builds the Claude Code command for the MCP endpoint', () => {
  expect(mcpCommand('tcms_pat_abc', 'https://api.example.cz/api/v1')).toBe(
    'claude mcp add --transport http thecms https://api.example.cz/api/v1/mcp --header "Authorization: Bearer tcms_pat_abc"',
  )
})
