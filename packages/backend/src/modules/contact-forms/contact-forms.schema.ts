import { z } from 'zod';
import { FormFieldType } from '../../models/contact-form.model';
import { SubmissionStatus } from '../../models/form-submission.model';

/**
 * Validation schemas for contact form endpoints
 */

const formFieldSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.nativeEnum(FormFieldType),
  label: z.string().min(1).max(100),
  placeholder: z.string().max(200).optional(),
  required: z.boolean().default(false),
  options: z.array(z.string()).optional(),
  validation: z
    .object({
      minLength: z.number().int().min(0).optional(),
      maxLength: z.number().int().min(1).optional(),
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
    })
    .optional(),
});

export const createContactFormSchema = z.object({
  body: z.object({
    name: z.string().min(1).max(100),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
    description: z.string().max(500).optional(),
    recipientEmail: z.string().email(),
    fields: z.array(formFieldSchema).min(1),
    siteId: z.string().optional(),
  }),
});

export const updateContactFormSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    name: z.string().min(1).max(100).optional(),
    slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
    description: z.string().max(500).optional(),
    recipientEmail: z.string().email().optional(),
    fields: z.array(formFieldSchema).min(1).optional(),
    isActive: z.boolean().optional(),
    siteId: z.string().optional(),
  }),
});

export const getContactFormSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export const deleteContactFormSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
});

export const listContactFormsSchema = z.object({
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20)),
    isActive: z
      .string()
      .optional()
      .transform((val) => (val === undefined ? undefined : val === 'true')),
  }),
});

export const listSubmissionsSchema = z.object({
  params: z.object({
    formId: z.string(),
  }),
  query: z.object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1)),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20)),
    status: z
      .string()
      .optional()
      .transform((val) =>
        val && Object.values(SubmissionStatus).includes(val as SubmissionStatus)
          ? (val as SubmissionStatus)
          : undefined
      ),
  }),
});

export const getSubmissionSchema = z.object({
  params: z.object({
    formId: z.string(),
    submissionId: z.string(),
  }),
});

export const updateSubmissionStatusSchema = z.object({
  params: z.object({
    formId: z.string(),
    submissionId: z.string(),
  }),
  body: z.object({
    status: z.nativeEnum(SubmissionStatus),
  }),
});

export const deleteSubmissionSchema = z.object({
  params: z.object({
    formId: z.string(),
    submissionId: z.string(),
  }),
});

export const getSubmissionStatsSchema = z.object({
  params: z.object({
    formId: z.string(),
  }),
});

export type CreateContactFormInput = z.infer<typeof createContactFormSchema>['body'];
export type UpdateContactFormInput = z.infer<typeof updateContactFormSchema>['body'];
