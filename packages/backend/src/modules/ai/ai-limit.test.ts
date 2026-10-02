jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (req: { header(name: string): string | undefined; user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { entraId: req.header('x-test-user') ?? 'user-a', email: 'a@test', role: 'EDITOR' };
    next();
  },
}));
jest.mock('./providers', () => ({
  ...jest.requireActual('./providers'),
  createProvider: jest.fn(() => ({ stream: jest.fn().mockResolvedValue({ inputTokens: 0, outputTokens: 0 }) })),
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import aiRoutes from './ai.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/ai', aiRoutes);
app.use(errorMiddleware);

const body = { action: 'fix', field: { label: 'Perex', type: 'TEXT', value: 'Ahoj' }, context: { contentType: 'Post', language: 'cs', fields: [] } };

beforeEach(() => {
  process.env.AI_KEY_SECRET = Buffer.alloc(32, 7).toString('base64');
  process.env.AI_REQUESTS_PER_MINUTE = '2';
});
afterAll(() => {
  delete process.env.AI_KEY_SECRET;
  delete process.env.AI_REQUESTS_PER_MINUTE;
});

it('limits generate requests per user', async () => {
  await request(app).put('/ai/connection').send({ provider: 'anthropic', model: 'claude-sonnet-5', apiKey: 'sk-ant-test-key-abcd' });
  await request(app).put('/ai/connection').set('x-test-user', 'user-b').send({ provider: 'anthropic', model: 'claude-sonnet-5', apiKey: 'sk-ant-test-key-efgh' });
  const statuses = [];
  for (let i = 0; i < 3; i++) statuses.push((await request(app).post('/ai/generate').send(body)).status);
  expect(statuses).toEqual([200, 200, 429]);
  expect((await request(app).post('/ai/generate').set('x-test-user', 'user-b').send(body)).status).toBe(200);
});
