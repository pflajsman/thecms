jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (req: { header(name: string): string | undefined; user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { entraId: req.header('x-test-user') ?? 'user-a', email: 'a@test', role: req.header('x-test-role') ?? 'EDITOR' };
    next();
  },
}));
const streamMock = jest.fn();
jest.mock('./providers', () => ({ ...jest.requireActual('./providers'), createProvider: jest.fn(() => ({ stream: streamMock })) }));

import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { AiProviderError, createProvider } from './providers';
import aiRoutes from './ai.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/ai', aiRoutes);
app.use(errorMiddleware);

const body = {
  action: 'rewrite',
  field: { label: 'Perex', type: 'TEXT', value: 'Byli jsme na Šumavě.' },
  context: { contentType: 'Blog post', language: 'cs', fields: [] },
};

function events(text: string) {
  return text
    .trim()
    .split('\n\n')
    .map((block) => {
      const [event, data] = block.split('\n');
      return { event: event.replace('event: ', ''), data: JSON.parse(data.replace('data: ', '')) };
    });
}

async function connect(user = 'user-a', key = 'sk-ant-test-key-abcd') {
  streamMock.mockResolvedValueOnce({ inputTokens: 1, outputTokens: 1 });
  await request(app).put('/ai/connection').set('x-test-user', user).send({ provider: 'anthropic', model: 'claude-sonnet-5', apiKey: key });
}

beforeEach(() => {
  process.env.AI_KEY_SECRET = Buffer.alloc(32, 7).toString('base64');
  streamMock.mockReset();
  jest.mocked(createProvider).mockClear();
});
afterAll(() => {
  delete process.env.AI_KEY_SECRET;
});

it('streams the answer with the user own key and counts the usage', async () => {
  await connect('user-a', 'sk-ant-key-of-a-1111');
  await connect('user-b', 'sk-ant-key-of-b-2222');
  streamMock.mockImplementation(async (_prompt: unknown, _signal: AbortSignal, onText: (t: string) => void) => {
    onText('Ahoj');
    onText(' světe');
    return { inputTokens: 10, outputTokens: 3 };
  });
  const res = await request(app).post('/ai/generate').set('x-test-user', 'user-b').send(body);
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toContain('text/event-stream');
  expect(events(res.text)).toEqual([
    { event: 'delta', data: { text: 'Ahoj' } },
    { event: 'delta', data: { text: ' světe' } },
    { event: 'done', data: { inputTokens: 10, outputTokens: 3 } },
  ]);
  expect(jest.mocked(createProvider).mock.calls.at(-1)?.[0]).toMatchObject({ apiKey: 'sk-ant-key-of-b-2222' });
  const prompt = streamMock.mock.calls.at(-1)?.[0] as { system: string };
  expect(prompt.system).toContain('Write in Czech.');
  const usage = (await request(app).get('/ai/connection').set('x-test-user', 'user-b')).body.data.usage;
  expect(usage).toMatchObject({ requests: 1, inputTokens: 10, outputTokens: 3 });
  expect((await request(app).get('/ai/connection')).body.data.usage.requests).toBe(0);
});

it('sends a provider failure as an error event and still counts the request', async () => {
  await connect();
  streamMock.mockRejectedValue(new AiProviderError('RATE_LIMIT', 'The AI service is limiting requests; try again shortly'));
  const res = await request(app).post('/ai/generate').send(body);
  expect(events(res.text)).toEqual([{ event: 'error', data: { code: 'RATE_LIMIT', message: 'The AI service is limiting requests; try again shortly' } }]);
  expect((await request(app).get('/ai/connection')).body.data.usage.requests).toBe(1);
});

it('refuses before streaming when not connected, turned off, for viewers, or without an instruction', async () => {
  const notConnected = await request(app).post('/ai/generate').send(body);
  expect(notConnected.status).toBe(409);
  expect(notConnected.body.reason).toBe('NOT_CONNECTED');
  await connect();
  expect((await request(app).post('/ai/generate').set('x-test-role', 'VIEWER').send(body)).status).toBe(403);
  expect((await request(app).post('/ai/generate').send({ ...body, action: 'draft' })).status).toBe(400);
  await request(app).put('/ai/settings').set('x-test-role', 'ADMIN').send({ enabled: false });
  const off = await request(app).post('/ai/generate').send(body);
  expect(off.status).toBe(403);
  expect(off.body.reason).toBe('AI_DISABLED');
});

it('aborts the provider call when the client goes away', async () => {
  await connect();
  let seenSignal: AbortSignal | undefined;
  const aborted = new Promise<void>((resolve) => {
    streamMock.mockImplementation(async (_prompt: unknown, signal: AbortSignal, onText: (t: string) => void) => {
      seenSignal = signal;
      onText('Začátek');
      await new Promise<void>((done) => signal.addEventListener('abort', () => done(), { once: true }));
      resolve();
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    });
  });
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => {
    const req = http.request({ port, path: '/ai/generate', method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      res.once('data', () => {
        req.destroy();
        resolve();
      });
    });
    req.end(JSON.stringify(body));
  });
  await aborted;
  expect(seenSignal?.aborted).toBe(true);
  await new Promise((resolve) => setTimeout(resolve, 50));
  server.close();
  expect((await request(app).get('/ai/connection')).body.data.usage.requests).toBe(1);
});
