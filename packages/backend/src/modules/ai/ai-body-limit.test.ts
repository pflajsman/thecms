jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (req: { user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { entraId: 'user-a', email: 'a@test', role: 'EDITOR' };
    next();
  },
}));
jest.mock('./providers', () => ({
  ...jest.requireActual('./providers'),
  createProvider: jest.fn(() => ({ stream: jest.fn().mockResolvedValue({ inputTokens: 0, outputTokens: 0 }) })),
}));

import request from 'supertest';
import { useTestDb } from '../../test/db';
import { app } from '../../app';

useTestDb();

const body = (size: number) => ({
  action: 'rewrite',
  field: { label: 'Body', type: 'RICH_TEXT', value: 'a'.repeat(size) },
  context: { contentType: 'Post', language: 'cs', fields: [{ label: 'Title', value: 'b'.repeat(15_000) }] },
});

beforeEach(() => {
  process.env.AI_KEY_SECRET = Buffer.alloc(32, 7).toString('base64');
});
afterAll(() => {
  delete process.env.AI_KEY_SECRET;
});

it('accepts a long article above the default 100 kB body limit so the backend can trim it', async () => {
  await request(app).put('/api/v1/ai/connection').send({ provider: 'anthropic', model: 'claude-sonnet-5', apiKey: 'sk-ant-test-key-abcd' });
  const res = await request(app).post('/api/v1/ai/generate').send(body(95_000));
  expect(res.status).toBe(200);
});

it('answers a body that is too big with TOO_LONG', async () => {
  const huge = { ...body(10), context: { contentType: 'Post', language: 'cs', fields: Array.from({ length: 50 }, (_, i) => ({ label: `F${i}`, value: 'c'.repeat(60_000) })) } };
  const res = await request(app).post('/api/v1/ai/generate').send(huge);
  expect(res.status).toBe(413);
  expect(res.body.reason).toBe('TOO_LONG');
});
