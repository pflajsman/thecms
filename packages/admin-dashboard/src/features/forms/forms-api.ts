import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import apiClient from '@/lib/api'
import type { ApiResponse, ContactForm, FormFieldDefinition, PaginatedResponse } from '@/types'

export interface FormPayload {
  name: string
  slug: string
  description?: string
  recipientEmail: string
  fields: FormFieldDefinition[]
  siteId?: string
  isActive?: boolean
}

export const formKeys = {
  all: ['forms'] as const,
  list: () => [...formKeys.all, 'list'] as const,
  item: (id: string) => [...formKeys.all, 'item', id] as const,
}

export async function listForms(): Promise<ContactForm[]> {
  return (await apiClient.get<PaginatedResponse<ContactForm>>('/contact-forms', { params: { page: 1, limit: 100 } })).data.data
}

export async function getForm(id: string): Promise<ContactForm> {
  return (await apiClient.get<ApiResponse<ContactForm>>(`/contact-forms/${id}`)).data.data
}

export function useForms() {
  return useQuery({ queryKey: formKeys.list(), queryFn: listForms })
}

export function useForm(id?: string) {
  return useQuery({ queryKey: formKeys.item(id ?? ''), queryFn: () => getForm(id!), enabled: !!id })
}

export function useFormWrites() {
  const queryClient = useQueryClient()
  return useMemo(() => {
    const refresh = () => void queryClient.invalidateQueries({ queryKey: formKeys.all })
    return {
      create: async (body: FormPayload) => {
        const form = (await apiClient.post<ApiResponse<ContactForm>>('/contact-forms', body)).data.data
        queryClient.setQueryData(formKeys.item(form.id), form)
        refresh()
        return form
      },
      update: async (id: string, body: FormPayload) => {
        const form = (await apiClient.put<ApiResponse<ContactForm>>(`/contact-forms/${id}`, body)).data.data
        queryClient.setQueryData(formKeys.item(id), form)
        refresh()
        return form
      },
      remove: async (id: string) => {
        await apiClient.delete(`/contact-forms/${id}`)
        queryClient.removeQueries({ queryKey: formKeys.item(id) })
        refresh()
      },
    }
  }, [queryClient])
}
