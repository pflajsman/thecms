import apiClient from '@/lib/api'
import type { FormFieldType, FormSubmission, PaginatedResponse, SubmissionStatus } from '@/types'

export interface InboxForm {
  id: string
  name: string
  slug: string
  fields: { name: string; label: string; type: FormFieldType }[]
}

export type InboxItem = FormSubmission & { form: InboxForm | null }
export type InboxView = 'unread' | 'all' | 'archived'

export interface InboxParams {
  formId?: string
  status?: SubmissionStatus
  page?: number
  limit?: number
}

export async function listInbox(params: InboxParams): Promise<PaginatedResponse<InboxItem>> {
  const query = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
  return (await apiClient.get<PaginatedResponse<InboxItem>>('/submissions', { params: query })).data
}
