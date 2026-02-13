import mongoose from 'mongoose';
import { ContactFormModel, IContactForm, FormFieldType } from '../../models/contact-form.model';
import { FormSubmissionModel, IFormSubmission, SubmissionStatus } from '../../models/form-submission.model';
import { EmailService } from '../../services/email.service';
import { CreateContactFormInput, UpdateContactFormInput } from './contact-forms.schema';

/**
 * Contact Forms Service
 * Business logic for contact form management
 */
export class ContactFormsService {
  /**
   * Create a new contact form
   */
  static async createForm(data: CreateContactFormInput & { createdBy?: string }): Promise<IContactForm> {
    const form = new ContactFormModel(data);
    await form.save();
    return form;
  }

  /**
   * List contact forms with pagination
   */
  static async listForms(options: {
    page?: number;
    limit?: number;
    isActive?: boolean;
  }): Promise<{ forms: IContactForm[]; pagination: any }> {
    const { page = 1, limit = 20, isActive } = options;

    const query: any = {};
    if (isActive !== undefined) {
      query.isActive = isActive;
    }

    const skip = (page - 1) * limit;

    const [forms, total] = await Promise.all([
      ContactFormModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      ContactFormModel.countDocuments(query),
    ]);

    return {
      forms,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get contact form by ID
   */
  static async getFormById(id: string): Promise<IContactForm | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid contact form ID');
    }
    return ContactFormModel.findById(id).exec();
  }

  /**
   * Get contact form by slug
   */
  static async getFormBySlug(slug: string): Promise<IContactForm | null> {
    return ContactFormModel.findOne({ slug, isActive: true }).exec();
  }

  /**
   * Update contact form
   */
  static async updateForm(id: string, data: UpdateContactFormInput): Promise<IContactForm | null> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid contact form ID');
    }

    const form = await ContactFormModel.findById(id);
    if (!form) return null;

    Object.assign(form, data);
    await form.save();
    return form;
  }

  /**
   * Delete contact form
   */
  static async deleteForm(id: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid contact form ID');
    }

    const result = await ContactFormModel.findByIdAndDelete(id);
    if (result) {
      // Also delete all submissions for this form
      await FormSubmissionModel.deleteMany({ formId: id });
    }
    return result !== null;
  }

  /**
   * Create a new submission
   */
  static async createSubmission(options: {
    formId: string;
    data: Record<string, any>;
    submitterIp?: string;
    submitterUserAgent?: string;
  }): Promise<IFormSubmission> {
    const form = await ContactFormModel.findById(options.formId);
    if (!form) {
      throw new Error('Contact form not found');
    }
    if (!form.isActive) {
      throw new Error('Contact form is not active');
    }

    // Validate submission data against form fields
    for (const field of form.fields) {
      const value = options.data[field.name];

      if (field.required && (value === undefined || value === null || value === '')) {
        throw new Error(`Field "${field.label}" is required`);
      }

      if (value !== undefined && value !== null && value !== '') {
        validateFieldValue(field.type, field.label, value, field.validation);
      }
    }

    const submission = new FormSubmissionModel({
      formId: options.formId,
      data: options.data,
      submitterIp: options.submitterIp,
      submitterUserAgent: options.submitterUserAgent,
    });

    await submission.save();

    // Increment submission count
    await ContactFormModel.findByIdAndUpdate(options.formId, {
      $inc: { submissionCount: 1 },
    });

    // Fire-and-forget email notification
    const fields = form.fields
      .filter((f) => options.data[f.name] !== undefined)
      .map((f) => ({
        label: f.label,
        value: String(options.data[f.name]),
      }));

    EmailService.sendFormNotification({
      to: form.recipientEmail,
      formName: form.name,
      fields,
    })
      .then(() => {
        FormSubmissionModel.findByIdAndUpdate(submission._id, { emailSent: true }).exec();
      })
      .catch((err) => {
        console.error('Failed to send form notification email:', err);
        FormSubmissionModel.findByIdAndUpdate(submission._id, {
          emailError: err instanceof Error ? err.message : 'Unknown error',
        }).exec();
      });

    return submission;
  }

  /**
   * List submissions for a form
   */
  static async listSubmissions(options: {
    formId: string;
    page?: number;
    limit?: number;
    status?: SubmissionStatus;
  }): Promise<{ submissions: IFormSubmission[]; pagination: any }> {
    const { formId, page = 1, limit = 20, status } = options;

    if (!mongoose.Types.ObjectId.isValid(formId)) {
      throw new Error('Invalid form ID');
    }

    const query: any = { formId };
    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      FormSubmissionModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      FormSubmissionModel.countDocuments(query),
    ]);

    return {
      submissions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get a single submission
   */
  static async getSubmissionById(submissionId: string): Promise<IFormSubmission | null> {
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      throw new Error('Invalid submission ID');
    }
    return FormSubmissionModel.findById(submissionId).exec();
  }

  /**
   * Update submission status
   */
  static async updateSubmissionStatus(
    submissionId: string,
    status: SubmissionStatus
  ): Promise<IFormSubmission | null> {
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      throw new Error('Invalid submission ID');
    }
    return FormSubmissionModel.findByIdAndUpdate(
      submissionId,
      { status },
      { new: true }
    ).exec();
  }

  /**
   * Delete a submission
   */
  static async deleteSubmission(formId: string, submissionId: string): Promise<boolean> {
    if (!mongoose.Types.ObjectId.isValid(submissionId)) {
      throw new Error('Invalid submission ID');
    }

    const result = await FormSubmissionModel.findOneAndDelete({
      _id: submissionId,
      formId,
    });

    if (result) {
      await ContactFormModel.findByIdAndUpdate(formId, {
        $inc: { submissionCount: -1 },
      });
    }

    return result !== null;
  }

  /**
   * Get submission stats for a form
   */
  static async getSubmissionStats(formId: string): Promise<{
    total: number;
    unread: number;
    read: number;
    archived: number;
  }> {
    if (!mongoose.Types.ObjectId.isValid(formId)) {
      throw new Error('Invalid form ID');
    }

    const [total, unread, read, archived] = await Promise.all([
      FormSubmissionModel.countDocuments({ formId }),
      FormSubmissionModel.countDocuments({ formId, status: SubmissionStatus.UNREAD }),
      FormSubmissionModel.countDocuments({ formId, status: SubmissionStatus.READ }),
      FormSubmissionModel.countDocuments({ formId, status: SubmissionStatus.ARCHIVED }),
    ]);

    return { total, unread, read, archived };
  }
}

/**
 * Validate a field value against its type and validation rules
 */
function validateFieldValue(
  type: FormFieldType,
  label: string,
  value: any,
  validation?: { minLength?: number; maxLength?: number; min?: number; max?: number; pattern?: string }
): void {
  switch (type) {
    case FormFieldType.EMAIL: {
      if (typeof value !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        throw new Error(`Field "${label}" must be a valid email address`);
      }
      break;
    }
    case FormFieldType.NUMBER: {
      const num = Number(value);
      if (isNaN(num)) {
        throw new Error(`Field "${label}" must be a number`);
      }
      if (validation?.min !== undefined && num < validation.min) {
        throw new Error(`Field "${label}" must be at least ${validation.min}`);
      }
      if (validation?.max !== undefined && num > validation.max) {
        throw new Error(`Field "${label}" must be at most ${validation.max}`);
      }
      break;
    }
    case FormFieldType.TEXT:
    case FormFieldType.TEXTAREA: {
      if (typeof value !== 'string') {
        throw new Error(`Field "${label}" must be a string`);
      }
      if (validation?.minLength !== undefined && value.length < validation.minLength) {
        throw new Error(`Field "${label}" must be at least ${validation.minLength} characters`);
      }
      if (validation?.maxLength !== undefined && value.length > validation.maxLength) {
        throw new Error(`Field "${label}" must be at most ${validation.maxLength} characters`);
      }
      if (validation?.pattern) {
        const regex = new RegExp(validation.pattern);
        if (!regex.test(value)) {
          throw new Error(`Field "${label}" does not match the required pattern`);
        }
      }
      break;
    }
    case FormFieldType.CHECKBOX: {
      if (typeof value !== 'boolean') {
        throw new Error(`Field "${label}" must be a boolean`);
      }
      break;
    }
    case FormFieldType.DATE: {
      if (isNaN(Date.parse(String(value)))) {
        throw new Error(`Field "${label}" must be a valid date`);
      }
      break;
    }
  }
}
