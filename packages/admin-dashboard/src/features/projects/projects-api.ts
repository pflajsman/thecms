import apiClient from '@/lib/api'
import type { ApiResponse } from '@/types'

export type ProjectRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER'
export const PROJECT_ROLES: ProjectRole[] = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']
export type InviteLanguage = 'en' | 'cs'

/** A loose email check; the server validates properly. */
export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface MyProject {
  id: string
  name: string
  role: ProjectRole
}

export interface Me {
  entraId: string
  email: string
  displayName?: string
  isSuperadmin: boolean
  projects: MyProject[]
}

export interface ProjectSummary {
  id: string
  name: string
  status: 'active' | 'archived'
  createdAt: string
  memberCount: number
}

export interface Member {
  userId: string
  email: string
  displayName?: string
  role: ProjectRole
  createdAt: string
}

export interface Invitation {
  id: string
  email: string
  role: ProjectRole
  expiresAt: string
  expired: boolean
  createdAt: string
}

export interface CreatedInvitation {
  invitation: Invitation
  inviteUrl: string
  emailSent: boolean
}

export interface InvitePreview {
  projectName: string
  role: ProjectRole
  invitedByName: string
}

export async function getMe(): Promise<Me> {
  return (await apiClient.get<ApiResponse<Me>>('/users/me')).data.data
}

export async function listAllProjects(): Promise<ProjectSummary[]> {
  return (await apiClient.get<ApiResponse<ProjectSummary[]>>('/projects')).data.data
}

export async function createProject(body: { name: string; ownerEmail: string; language: InviteLanguage }): Promise<CreatedInvitation & { project: ProjectSummary }> {
  return (await apiClient.post<ApiResponse<CreatedInvitation & { project: ProjectSummary }>>('/projects', body)).data.data
}

export async function updateProject(id: string, body: { name?: string; status?: 'active' | 'archived' }): Promise<ProjectSummary> {
  return (await apiClient.patch<ApiResponse<ProjectSummary>>(`/projects/${id}`, body)).data.data
}

export async function renameCurrentProject(name: string): Promise<ProjectSummary> {
  return (await apiClient.patch<ApiResponse<ProjectSummary>>('/project', { name })).data.data
}

export async function listMembers(): Promise<{ members: Member[]; invitations: Invitation[] }> {
  return (await apiClient.get<ApiResponse<{ members: Member[]; invitations: Invitation[] }>>('/members')).data.data
}

export async function changeMemberRole(userId: string, role: ProjectRole): Promise<void> {
  await apiClient.patch(`/members/${encodeURIComponent(userId)}`, { role })
}

export async function removeMember(userId: string): Promise<void> {
  await apiClient.delete(`/members/${encodeURIComponent(userId)}`)
}

export async function inviteMember(body: { email: string; role: ProjectRole; language: InviteLanguage }): Promise<CreatedInvitation> {
  return (await apiClient.post<ApiResponse<CreatedInvitation>>('/invitations', body)).data.data
}

export async function resendInvitation(id: string, language: InviteLanguage): Promise<CreatedInvitation> {
  return (await apiClient.post<ApiResponse<CreatedInvitation>>(`/invitations/${id}/resend`, { language })).data.data
}

export async function revokeInvitation(id: string): Promise<void> {
  await apiClient.delete(`/invitations/${id}`)
}

export async function previewInvite(token: string): Promise<InvitePreview> {
  return (await apiClient.get<ApiResponse<InvitePreview>>(`/invites/${encodeURIComponent(token)}`)).data.data
}

export async function acceptInvite(token: string): Promise<{ projectId: string }> {
  return (await apiClient.post<ApiResponse<{ projectId: string }>>(`/invites/${encodeURIComponent(token)}/accept`)).data.data
}
