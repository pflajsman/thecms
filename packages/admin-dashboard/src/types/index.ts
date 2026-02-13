// Field Types
export type FieldType = 'TEXT' | 'RICH_TEXT' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'MEDIA' | 'RELATION';

export interface ValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  allowedContentTypes?: string[];
  multiple?: boolean;
  allowedMimeTypes?: string[];
  maxFileSize?: number;
}

export interface Field {
  name: string;
  type: FieldType;
  label: string;
  description?: string;
  required?: boolean;
  validation?: ValidationRules;
  defaultValue?: any;
}

export interface ContentType {
  id: string;
  name: string;
  slug: string;
  description?: string;
  fields: Field[];
  createdAt: string;
  updatedAt: string;
}

export interface ContentEntry {
  id: string;
  contentTypeId: string;
  contentType?: ContentType;
  data: Record<string, any>;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface MediaFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  blobUrl: string;
  cdnUrl?: string;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  variants?: MediaVariant[];
  tags?: string[];
  altText?: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaVariant {
  name: string;
  width: number;
  height: number;
  url: string;
  size: number;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  details?: any;
}

// Contact Forms
export type FormFieldType = 'TEXT' | 'EMAIL' | 'TEXTAREA' | 'SELECT' | 'NUMBER' | 'CHECKBOX' | 'DATE';

export interface FormFieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface FormFieldDefinition {
  name: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  validation?: FormFieldValidation;
}

export interface ContactForm {
  id: string;
  name: string;
  slug: string;
  description?: string;
  fields: FormFieldDefinition[];
  recipientEmail: string;
  siteId?: string;
  isActive: boolean;
  submissionCount: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type SubmissionStatus = 'UNREAD' | 'READ' | 'ARCHIVED';

export interface FormSubmission {
  id: string;
  formId: string;
  data: Record<string, any>;
  status: SubmissionStatus;
  submitterIp?: string;
  submitterUserAgent?: string;
  emailSent: boolean;
  emailError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionStats {
  total: number;
  unread: number;
  read: number;
  archived: number;
}
