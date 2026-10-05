import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  acceptInvite,
  changeMemberRole,
  createProject,
  getMe,
  inviteMember,
  listAllProjects,
  listMembers,
  removeMember,
  renameCurrentProject,
  resendInvitation,
  revokeInvitation,
  updateProject,
  previewInvite,
  type InviteLanguage,
  type ProjectRole,
} from './projects-api'

/** `me` stays when the project changes; everything else is project data. */
export const projectKeys = {
  me: ['me'] as const,
  all: ['projects', 'all'] as const,
  members: ['members'] as const,
  invite: (token: string) => ['invite', token] as const,
}

export function useMe(options: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: projectKeys.me, queryFn: getMe, staleTime: 60_000, enabled: options.enabled })
}

export function useAllProjects() {
  return useQuery({ queryKey: projectKeys.all, queryFn: listAllProjects })
}

export function useMembers() {
  return useQuery({ queryKey: projectKeys.members, queryFn: listMembers })
}

export function useInvitePreview(token: string) {
  return useQuery({ queryKey: projectKeys.invite(token), queryFn: () => previewInvite(token), retry: false })
}

export function useProjectWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refreshProjects = () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.all })
      void queryClient.invalidateQueries({ queryKey: projectKeys.me })
    }
    return {
      create: async (body: { name: string; ownerEmail: string; language: InviteLanguage }) => {
        const created = await createProject(body)
        refreshProjects()
        return created
      },
      update: async (id: string, body: { name?: string; status?: 'active' | 'archived' }) => {
        const updated = await updateProject(id, body)
        refreshProjects()
        return updated
      },
      renameCurrent: async (name: string) => {
        const renamed = await renameCurrentProject(name)
        refreshProjects()
        return renamed
      },
      accept: async (token: string) => {
        const accepted = await acceptInvite(token)
        await queryClient.invalidateQueries({ queryKey: projectKeys.me })
        return accepted
      },
    }
  }, [queryClient])
}

export function useMemberWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: projectKeys.members })
    const after = async <T,>(work: Promise<T>) => {
      const result = await work
      refresh()
      return result
    }
    return {
      changeRole: (userId: string, role: ProjectRole) => after(changeMemberRole(userId, role)),
      remove: (userId: string) => after(removeMember(userId)),
      invite: (body: { email: string; role: ProjectRole; language: InviteLanguage }) => after(inviteMember(body)),
      resend: (id: string, language: InviteLanguage) => after(resendInvitation(id, language)),
      revoke: (id: string) => after(revokeInvitation(id)),
      /** Leaving the project: `me` changes, so the project list updates. */
      leave: async (userId: string) => {
        await removeMember(userId)
        await queryClient.invalidateQueries({ queryKey: projectKeys.me })
      },
    }
  }, [queryClient])
}
