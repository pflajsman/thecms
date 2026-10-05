jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { entraId: 'anna', email: 'anna@example.com', role: 'VIEWER', isSuperadmin: false };
    next();
  },
}));
jest.mock('../../config/storage', () => ({
  storageService: {
    uploadFile: jest.fn(async (name: string) => ({ url: `https://blob.test/${name}`, cdnUrl: `https://cdn.test/${name}` })),
    deleteFile: jest.fn(),
  },
}));
jest.mock('../../services/webhook.service', () => ({
  WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) },
}));

import request from 'supertest';
import { app } from '../../app';
import { useTestDb } from '../../test/db';
import { ProjectMemberModel, ProjectRole } from '../../models/project-member.model';
import { MediaModel } from '../../models/media.model';
import { ProjectsService } from './projects.service';
import { setTestDefaultProject, withoutProject } from '../../utils/project-context';

useTestDb();
setTestDefaultProject(null);

// Multipart bodies are parsed from stream events, where async context is easy to lose.
it('keeps the project through a multipart upload', async () => {
  const { id } = await ProjectsService.create({ name: 'Alpha', createdBy: 'root' });
  await ProjectMemberModel.create({ projectId: id, userId: 'anna', role: ProjectRole.EDITOR });
  const pdf = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
  const res = await request(app)
    .post('/api/v1/media/upload')
    .set('x-project-id', id)
    .attach('file', pdf, { filename: 'guide.pdf', contentType: 'application/pdf' });
  expect([res.status, res.body.error]).toEqual([201, undefined]);
  const media = await withoutProject(() => MediaModel.findOne().lean());
  expect(String(media?.projectId)).toBe(id);
  expect(media?.filename.startsWith(`${id}/`)).toBe(true);
});
