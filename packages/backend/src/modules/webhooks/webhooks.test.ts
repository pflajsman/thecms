jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import webhooksRoutes from './webhooks.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/webhooks', webhooksRoutes);

it('returns the full secret only in the create response', async () => {
  const created = await request(app)
    .post('/webhooks')
    .send({ name: 'Deploy', url: 'https://example.com/hook', events: ['entry.published'] });
  expect(created.status).toBe(201);
  const secret: string = created.body.data.secret;
  expect(typeof secret).toBe('string');
  expect(secret.length).toBeGreaterThan(16);

  const fetched = await request(app).get(`/webhooks/${created.body.data.id}`);
  expect(fetched.body.data.secret).toBeUndefined();
  expect(fetched.body.data.secretPreview).toBe(`${secret.substring(0, 8)}...`);
});
