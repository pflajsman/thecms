import apiClient from '@/lib/api'
import { API_BASE_URL } from '@/lib/auth-header'
import type { ApiResponse } from '@/types'

export interface AccessToken {
  id: string
  name: string
  prefix: string
  createdAt: string
  lastUsedAt?: string
  expiresAt?: string
  expired: boolean
}

export type CreatedToken = AccessToken & { token: string }
export type TokenExpiry = 30 | 90 | 365

export const MAX_TOKENS = 10

export async function listTokens(): Promise<AccessToken[]> {
  return (await apiClient.get<ApiResponse<AccessToken[]>>('/tokens')).data.data
}

export async function createToken(body: { name: string; expiresInDays?: TokenExpiry }): Promise<CreatedToken> {
  return (await apiClient.post<ApiResponse<CreatedToken>>('/tokens', body)).data.data
}

export async function revokeToken(id: string): Promise<void> {
  await apiClient.delete(`/tokens/${id}`)
}

/** The command that connects Claude Code to this installation's MCP server. */
export function mcpCommand(token: string, base: string = API_BASE_URL): string {
  return `claude mcp add --transport http thecms ${base.replace(/\/+$/, '')}/mcp --header "Authorization: Bearer ${token}"`
}
