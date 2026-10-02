jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (req: { header(name: string): string | undefined; user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { entraId: req.header('x-test-user') ?? 'user-a', email: 'a@test', role: req.header('x-test-role') ?? 'EDITOR' };
    next();
  },
}));
const streamMock = jest.fn();
jest.mock('./providers', () => ({ ...jest.requireActual('./providers'), createProvider: jest.fn(() => ({ stream: streamMock })) }));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { AiConnectionModel } from '../../models/ai-connection.model';
import { AiProviderError, createProvider } from './providers';
import aiRoutes from './ai.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/ai', aiRoutes);
app.use(errorMiddleware);

const SECRET = Buffer.alloc(32, 7).toString('base64');
const CLAUDE_KEY = 'sk-ant-test-key-abcd';
const claude = { provider: 'anthropic', model: 'claude-sonnet-5', apiKey: CLAUDE_KEY };

beforeEach(() => {
  process.env.AI_KEY_SECRET = SECRET;
  streamMock.mockReset();
  streamMock.mockResolvedValue({ inputTokens: 1, outputTokens: 1 });
  jest.mocked(createProvider).mockClear();
});
afterAll(() => {
  delete process.env.AI_KEY_SECRET;
});

it('reports AI as not available without AI_KEY_SECRET and refuses to connect', async () => {
  delete process.env.AI_KEY_SECRET;
  expect((await request(app).get('/ai/connection')).body.data).toMatchObject({ available: false, connection: null });
  expect((await request(app).put('/ai/connection').send(claude)).status).toBe(503);
});

it('connects Claude after a test call, stores the key encrypted and never returns it', async () => {
  const res = await request(app).put('/ai/connection').send(claude);
  expect(res.status).toBe(200);
  expect(res.body.data).toMatchObject({ available: true, enabled: true, connection: { provider: 'anthropic', model: 'claude-sonnet-5', keyHint: 'abcd' } });
  expect(JSON.stringify(res.body)).not.toContain(CLAUDE_KEY);
  expect(jest.mocked(createProvider)).toHaveBeenCalledWith(expect.objectContaining({ provider: 'anthropic', apiKey: CLAUDE_KEY }));
  expect(streamMock).toHaveBeenCalledTimes(1);
  const stored = await AiConnectionModel.findOne({ userId: 'user-a' }).lean();
  expect(JSON.stringify(stored)).not.toContain(CLAUDE_KEY);
  expect(JSON.stringify((await request(app).get('/ai/connection')).body)).not.toContain(CLAUDE_KEY);
});

it('refuses a key the service rejects, without echoing it, and saves nothing', async () => {
  streamMock.mockRejectedValue(new AiProviderError('AUTH', 'The AI service refused the key'));
  const res = await request(app).put('/ai/connection').send(claude);
  expect(res.status).toBe(400);
  expect(res.body).toMatchObject({ reason: 'AUTH', error: 'The AI service refused the key' });
  expect(JSON.stringify(res.body)).not.toContain(CLAUDE_KEY);
  expect(await AiConnectionModel.countDocuments()).toBe(0);
});

it('keeps the stored key when only the model changes', async () => {
  await request(app).put('/ai/connection').send(claude);
  const res = await request(app).put('/ai/connection').send({ provider: 'anthropic', model: 'claude-haiku-4-5-20251001' });
  expect(res.status).toBe(200);
  expect(res.body.data.connection).toMatchObject({ model: 'claude-haiku-4-5-20251001', keyHint: 'abcd' });
  expect(jest.mocked(createProvider).mock.calls[1][0]).toMatchObject({ apiKey: CLAUDE_KEY });
});

it('connects a local OpenAI-compatible service without a key, and needs a key for Claude', async () => {
  const res = await request(app).put('/ai/connection').send({ provider: 'openai-compatible', model: 'llama3.2', baseUrl: 'http://localhost:11434/v1/' });
  expect(res.status).toBe(200);
  expect(res.body.data.connection).toMatchObject({ provider: 'openai-compatible', baseUrl: 'http://localhost:11434/v1' });
  expect(res.body.data.connection.keyHint).toBeUndefined();
  const noKey = await request(app).put('/ai/connection').send({ provider: 'anthropic', model: 'claude-sonnet-5' });
  expect(noKey.status).toBe(400);
  expect(noKey.body.reason).toBe('KEY_REQUIRED');
  expect(await request(app).put('/ai/connection').send({ provider: 'anthropic', model: 'gpt-4' }).then((r) => r.status)).toBe(400);
});

it('keeps connections per user', async () => {
  await request(app).put('/ai/connection').send(claude);
  expect((await request(app).get('/ai/connection').set('x-test-user', 'user-b')).body.data.connection).toBeNull();
  await request(app).delete('/ai/connection').set('x-test-user', 'user-b');
  expect((await request(app).get('/ai/connection')).body.data.connection).toMatchObject({ keyHint: 'abcd' });
  await request(app).delete('/ai/connection');
  expect((await request(app).get('/ai/connection')).body.data.connection).toBeNull();
});

it('lets only admins switch AI off, and then refuses connecting', async () => {
  expect((await request(app).put('/ai/settings').send({ enabled: false })).status).toBe(403);
  expect((await request(app).put('/ai/settings').set('x-test-role', 'ADMIN').send({ enabled: false })).status).toBe(200);
  expect((await request(app).get('/ai/connection')).body.data.enabled).toBe(false);
  const res = await request(app).put('/ai/connection').send(claude);
  expect(res.status).toBe(403);
  expect(res.body.reason).toBe('AI_DISABLED');
});

it('refuses viewers', async () => {
  expect((await request(app).get('/ai/connection').set('x-test-role', 'VIEWER')).status).toBe(403);
});

it('asks to connect again when the stored key cannot be read', async () => {
  await request(app).put('/ai/connection').send(claude);
  process.env.AI_KEY_SECRET = Buffer.alloc(32, 9).toString('base64');
  const res = await request(app).put('/ai/connection').send({ provider: 'anthropic', model: 'claude-opus-5-5' });
  expect(res.status).toBe(409);
  expect(res.body.reason).toBe('KEY_UNREADABLE');
});
