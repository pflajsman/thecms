import { Request, Response, NextFunction } from 'express';
import { ContactFormsService } from './contact-forms.service';

/**
 * Contact Forms Controller
 * Handles HTTP requests for contact form management
 */
export class ContactFormsController {
  /**
   * Create a new contact form
   * POST /api/v1/contact-forms
   */
  async createForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as any).user?.userId;

      const form = await ContactFormsService.createForm({
        ...req.body,
        createdBy: userId,
      });

      res.status(201).json({
        success: true,
        data: form,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List all contact forms
   * GET /api/v1/contact-forms
   */
  async listForms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page, limit, isActive } = req.query as any;

      const result = await ContactFormsService.listForms({
        page,
        limit,
        isActive,
      });

      res.status(200).json({
        success: true,
        data: result.forms,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get contact form by ID
   * GET /api/v1/contact-forms/:id
   */
  async getForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const form = await ContactFormsService.getFormById(id);

      if (!form) {
        res.status(404).json({
          success: false,
          error: 'Contact form not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: form,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update contact form
   * PUT /api/v1/contact-forms/:id
   */
  async updateForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const form = await ContactFormsService.updateForm(id, req.body);

      if (!form) {
        res.status(404).json({
          success: false,
          error: 'Contact form not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: form,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete contact form
   * DELETE /api/v1/contact-forms/:id
   */
  async deleteForm(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.params;

      const deleted = await ContactFormsService.deleteForm(id);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Contact form not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Contact form deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * List submissions for a form
   * GET /api/v1/contact-forms/:formId/submissions
   */
  async listSubmissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { formId } = req.params;
      const { page, limit, status } = req.query as any;

      const result = await ContactFormsService.listSubmissions({
        formId,
        page,
        limit,
        status,
      });

      res.status(200).json({
        success: true,
        data: result.submissions,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single submission
   * GET /api/v1/contact-forms/:formId/submissions/:submissionId
   */
  async getSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { submissionId } = req.params;

      const submission = await ContactFormsService.getSubmissionById(submissionId);

      if (!submission) {
        res.status(404).json({
          success: false,
          error: 'Submission not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: submission,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update submission status
   * PATCH /api/v1/contact-forms/:formId/submissions/:submissionId
   */
  async updateSubmissionStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { submissionId } = req.params;
      const { status } = req.body;

      const submission = await ContactFormsService.updateSubmissionStatus(submissionId, status);

      if (!submission) {
        res.status(404).json({
          success: false,
          error: 'Submission not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: submission,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete a submission
   * DELETE /api/v1/contact-forms/:formId/submissions/:submissionId
   */
  async deleteSubmission(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { formId, submissionId } = req.params;

      const deleted = await ContactFormsService.deleteSubmission(formId, submissionId);

      if (!deleted) {
        res.status(404).json({
          success: false,
          error: 'Submission not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Submission deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get submission stats
   * GET /api/v1/contact-forms/:formId/stats
   */
  async getSubmissionStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { formId } = req.params;

      const stats = await ContactFormsService.getSubmissionStats(formId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  }
}

// Export controller instance
export const contactFormsController = new ContactFormsController();
