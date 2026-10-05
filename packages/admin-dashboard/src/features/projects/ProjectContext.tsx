import { createContext, Fragment, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getCurrentProjectId, getStoredProjectId, setCurrentProjectId } from '@/lib/current-project'
import type { Me, MyProject, ProjectRole } from './projects-api'
import { projectKeys, useMe } from './projects-queries'
import { roleCan, type Capability } from './project-roles'

interface ProjectContextValue {
  me: Me
  projects: MyProject[]
  project: MyProject
  role: ProjectRole
  can: (capability: Capability) => boolean
  switchProject: (id: string) => void
}

const ProjectContext = createContext<ProjectContextValue | undefined>(undefined)

interface ProjectProviderProps {
  /** Shown while the user's projects load. */
  loading: ReactNode
  /** Shown when the user belongs to no project. */
  noProject: (me: Me | undefined, retry: () => void) => ReactNode
  children: ReactNode
}

/**
 * The project the admin works in. Every API call carries it (lib/current-project). When it changes, project data
 * is dropped from the cache and the pages remount, so nothing from the previous project is shown.
 */
export function ProjectProvider({ loading, noProject, children }: ProjectProviderProps) {
  const me = useMe()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [chosen, setChosen] = useState(getStoredProjectId)
  const projects = useMemo(() => me.data?.projects ?? [], [me.data])
  const project = projects.find((p) => p.id === chosen) ?? projects[0]

  // Set before the pages render, so their first request already goes to this project.
  if (me.data && getCurrentProjectId() !== (project?.id ?? null)) {
    const previous = getCurrentProjectId()
    setCurrentProjectId(project?.id ?? null)
    if (previous) queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== projectKeys.me[0] })
  }

  const switchProject = useCallback(
    (id: string) => {
      setChosen(id)
      navigate('/')
    },
    [navigate],
  )

  const value = useMemo<ProjectContextValue | undefined>(
    () =>
      me.data && project
        ? { me: me.data, projects, project, role: project.role, can: (c) => roleCan(project.role, c), switchProject }
        : undefined,
    [me.data, projects, project, switchProject],
  )

  if (me.isPending) return <>{loading}</>
  if (!value) return <>{noProject(me.data, () => void me.refetch())}</>
  return (
    <ProjectContext.Provider value={value}>
      <Fragment key={value.project.id}>{children}</Fragment>
    </ProjectContext.Provider>
  )
}

// Provider and hook live together so every consumer imports one module.
// eslint-disable-next-line react-refresh/only-export-components
export function useOptionalProject(): ProjectContextValue | undefined {
  return useContext(ProjectContext)
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext)
  if (!context) throw new Error('useProject must be used within a ProjectProvider')
  return context
}
