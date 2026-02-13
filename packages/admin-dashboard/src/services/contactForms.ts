import apiClient from '../lib/api';
import type {
  PaginatedResponse,
  ApiResponse,
  ContactForm,
  FormSubmission,
  SubmissionStatus,
  SubmissionStats,
} from '../types';

export const contactFormsService = {
  // List all contact forms
  list: async (page = 1, limit = 20): Promise<PaginatedResponse<ContactForm>> => {
    const response = await apiClient.get('/contact-forms', {
      params: { page, limit },
    });
    return response.data;
  },

  // Get single contact form by ID
  getById: async (id: string): Promise<ApiResponse<ContactForm>> => {
    const response = await apiClient.get(`/contact-forms/${id}`);
    return response.data;
  },

  // Create new contact form
  create: async (data: {
    name: string;
    slug: string;
    description?: string;
    recipientEmail: string;
    fields: ContactForm['fields'];
    siteId?: string;
  }): Promise<ApiResponse<ContactForm>> => {
    const response = await apiClient.post('/contact-forms', data);
    return response.data;
  },

  // Update contact form
  update: async (
    id: string,
    data: {
      name?: string;
      slug?: string;
      description?: string;
      recipientEmail?: string;
      fields?: ContactForm['fields'];
      isActive?: boolean;
      siteId?: string;
    }
  ): Promise<ApiResponse<ContactForm>> => {
    const response = await apiClient.put(`/contact-forms/${id}`, data);
    return response.data;
  },

  // Delete contact form
  delete: async (id: string): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(`/contact-forms/${id}`);
    return response.data;
  },

  // List submissions for a form
  listSubmissions: async (
    formId: string,
    page = 1,
    limit = 20,
    status?: SubmissionStatus
  ): Promise<PaginatedResponse<FormSubmission>> => {
    const response = await apiClient.get(`/contact-forms/${formId}/submissions`, {
      params: { page, limit, ...(status && { status }) },
    });
    return response.data;
  },

  // Get a single submission
  getSubmission: async (
    formId: string,
    submissionId: string
  ): Promise<ApiResponse<FormSubmission>> => {
    const response = await apiClient.get(
      `/contact-forms/${formId}/submissions/${submissionId}`
    );
    return response.data;
  },

  // Update submission status
  updateSubmissionStatus: async (
    formId: string,
    submissionId: string,
    status: SubmissionStatus
  ): Promise<ApiResponse<FormSubmission>> => {
    const response = await apiClient.patch(
      `/contact-forms/${formId}/submissions/${submissionId}`,
      { status }
    );
    return response.data;
  },

  // Delete submission
  deleteSubmission: async (
    formId: string,
    submissionId: string
  ): Promise<ApiResponse<{ message: string }>> => {
    const response = await apiClient.delete(
      `/contact-forms/${formId}/submissions/${submissionId}`
    );
    return response.data;
  },

  // Get submission stats
  getStats: async (formId: string): Promise<ApiResponse<SubmissionStats>> => {
    const response = await apiClient.get(`/contact-forms/${formId}/stats`);
    return response.data;
  },
};
