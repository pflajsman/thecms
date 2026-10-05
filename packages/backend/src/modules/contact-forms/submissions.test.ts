jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { ContactFormModel, FormFieldType } from '../../models/contact-form.model';
import { FormSubmissionModel, SubmissionStatus } from '../../models/form-submission.model';
import { ContactFormsService } from './contact-forms.service';
import submissionsRoutes from './submissions.routes';
import { getTestDefaultProject } from '../../utils/project-context';

// Raw driver inserts skip the tenant plugin, so they name the test project themselves.
const TEST_PROJECT = getTestDefaultProject()!;

useTestDb();

const app = express();
app.use('/submissions', submissionsRoutes);

async function seed() {
  const fields = [
    { name: 'email', label: 'Email', type: FormFieldType.EMAIL, required: true },
    { name: 'message', label: 'Message', type: FormFieldType.TEXTAREA, required: true },
  ];
  const contact = await ContactFormModel.create({ name: 'Contact', slug: 'contact', recipientEmail: 'me@x.test', fields });
  const tour = await ContactFormModel.create({ name: 'Tour booking', slug: 'tour', recipientEmail: 'me@x.test', fields });
  const at = (m: number) => new Date(Date.UTC(2026, 8, 29, 10, m));
  await FormSubmissionModel.collection.insertMany([
    { projectId: TEST_PROJECT, formId: contact._id, data: { email: 'a@x.test', message: 'One' }, status: SubmissionStatus.UNREAD, emailSent: true, createdAt: at(1), updatedAt: at(1) },
    { projectId: TEST_PROJECT, formId: tour._id, data: { email: 'b@x.test', message: 'Two' }, status: SubmissionStatus.READ, emailSent: true, createdAt: at(2), updatedAt: at(2) },
    { projectId: TEST_PROJECT, formId: contact._id, data: { email: 'c@x.test', message: 'Three' }, status: SubmissionStatus.UNREAD, emailSent: false, emailError: 'SMTP down', createdAt: at(3), updatedAt: at(3) },
  ]);
  return { contact, tour };
}

describe('ContactFormsService.listAllSubmissions', () => {
  it('lists submissions from every form, newest first, with form info', async () => {
    await seed();
    const res = await ContactFormsService.listAllSubmissions({});
    expect(res.submissions.map((s) => s.data.message)).toEqual(['Three', 'Two', 'One']);
    expect(res.submissions[0].form).toEqual({
      id: expect.any(String),
      name: 'Contact',
      slug: 'contact',
      fields: [
        { name: 'email', label: 'Email', type: 'EMAIL' },
        { name: 'message', label: 'Message', type: 'TEXTAREA' },
      ],
    });
    expect(res.pagination.total).toBe(3);
  });

  it('filters by form and status', async () => {
    const { contact } = await seed();
    const res = await ContactFormsService.listAllSubmissions({ formId: contact.id, status: SubmissionStatus.UNREAD });
    expect(res.submissions.map((s) => s.data.message)).toEqual(['Three', 'One']);
  });

  it('returns form null for submissions of a deleted form', async () => {
    const { tour } = await seed();
    await ContactFormModel.deleteOne({ _id: tour._id });
    const res = await ContactFormsService.listAllSubmissions({});
    expect(res.submissions.find((s) => s.data.message === 'Two')?.form).toBeNull();
  });
});

describe('GET /submissions', () => {
  it('responds with the list envelope', async () => {
    await seed();
    const res = await request(app).get('/submissions?status=UNREAD&limit=1');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(2);
  });

  it('rejects an invalid formId or status with 400', async () => {
    expect((await request(app).get('/submissions?formId=nope')).status).toBe(400);
    expect((await request(app).get('/submissions?status=SPAM')).status).toBe(400);
  });
});
