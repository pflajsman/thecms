jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (req: { header(name: string): string | undefined; user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { entraId: req.header('x-test-user') ?? 'user-a', email: 'a@test', role: req.header('x-test-role') ?? 'EDITOR' };
    next();
  },
}));
jest.mock('../../services/webhook.service', () => ({
  WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) },
}));
const streamMock = jest.fn();
jest.mock('./providers', () => ({ ...jest.requireActual('./providers'), createProvider: jest.fn(() => ({ stream: streamMock })) }));

import http from 'http';
import type { AddressInfo } from 'net';
import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { AiProviderError } from './providers';
import { ContentTypeModel } from '../../models/content-type.model';
import { ContentEntryModel, ContentStatus } from '../../models/content-entry.model';
import { LanguageModel } from '../../models/language.model';
import { FieldType } from '../../types/field-types';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { createVersion } from '../content-entries/entry-versions.service';
import aiRoutes from './ai.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/ai', aiRoutes);
app.use(errorMiddleware);

type Prompt = { system: string; user: string };
type Answer = string | { text: string; truncated?: boolean } | Error;

function events(text: string) {
  return text
    .trim()
    .split('\n\n')
    .map((block) => {
      const [event, data] = block.split('\n');
      return { event: event.replace('event: ', ''), data: JSON.parse(data.replace('data: ', '')) };
    });
}

async function connect() {
  streamMock.mockResolvedValueOnce({ inputTokens: 1, outputTokens: 1 });
  await request(app).put('/ai/connection').send({ provider: 'anthropic', model: 'claude-sonnet-5', apiKey: 'sk-ant-test-key-abcd' });
  streamMock.mockReset();
}

/** Answers per field label; every call reports 5 input and 2 output tokens. */
function answer(byLabel: Record<string, Answer | ((p: Prompt) => Promise<Answer>)>) {
  streamMock.mockImplementation(async (prompt: Prompt, _signal: AbortSignal, onText: (t: string) => void) => {
    const label = /<field label="([^"]*)">/.exec(prompt.user)?.[1] ?? '';
    const rule = byLabel[label];
    const result = typeof rule === 'function' ? await rule(prompt) : rule;
    if (result instanceof Error) throw result;
    const { text, truncated } = typeof result === 'string' ? { text: result, truncated: false } : result;
    onText(text);
    return { inputTokens: 5, outputTokens: 2, ...(truncated ? { truncated: true } : {}) };
  });
}

const translated = { Title: 'Bohemian Forest', Perex: 'We were there.', Body: '<p>Forest</p><script>alert(1)</script>' };

async function setup(data: Record<string, unknown> = {}) {
  await LanguageModel.create([
    { code: 'cs', name: 'Čeština', isDefault: true, order: 0 },
    { code: 'en', name: 'English', isDefault: false, order: 1 },
  ]);
  const type = await ContentTypeModel.create({
    name: 'Blog post',
    slug: 'blog-post',
    titleField: 'title',
    fields: [
      { name: 'perex', label: 'Perex', type: FieldType.TEXT, required: false },
      { name: 'title', label: 'Title', type: FieldType.TEXT, required: false },
      { name: 'body', label: 'Body', type: FieldType.RICH_TEXT, required: false },
      { name: 'note', label: 'Note', type: FieldType.TEXT, required: false },
      { name: 'code', label: 'Code', type: FieldType.TEXT, required: false, localized: false },
      { name: 'km', label: 'Distance', type: FieldType.NUMBER, required: false },
    ],
  });
  const entry = await ContentEntriesService.createEntry({
    contentTypeId: String(type._id),
    data: { title: 'Šumava', perex: 'Byli jsme tam.', body: '<p>Les</p>', note: '', code: 'SUM-1', km: 12, ...data },
  });
  return { type, entry };
}

const translate = (entryId: string, language = 'en') => request(app).post('/ai/translate').send({ entryId, language });

beforeEach(() => {
  process.env.AI_KEY_SECRET = Buffer.alloc(32, 7).toString('base64');
  streamMock.mockReset();
});
afterAll(() => {
  delete process.env.AI_KEY_SECRET;
});

it('translates the title field first, then the other translated text fields, and creates a draft', async () => {
  await connect();
  const { entry } = await setup();
  answer(translated);
  const res = await translate(String(entry._id));
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toContain('text/event-stream');
  const list = events(res.text);
  expect(list.slice(0, 4)).toEqual([
    { event: 'start', data: { fields: [{ name: 'title', label: 'Title' }, { name: 'perex', label: 'Perex' }, { name: 'body', label: 'Body' }] } },
    { event: 'field', data: { name: 'title', index: 1, total: 3 } },
    { event: 'field', data: { name: 'perex', index: 2, total: 3 } },
    { event: 'field', data: { name: 'body', index: 3, total: 3 } },
  ]);
  expect(list[4]).toEqual({ event: 'done', data: { versionId: expect.any(String), inputTokens: 15, outputTokens: 6 } });
  const version = await ContentEntryModel.findById(list[4].data.versionId).lean();
  expect(version).toMatchObject({ language: 'en', status: ContentStatus.DRAFT, title: 'Bohemian Forest' });
  expect(String(version?.itemId)).toBe(String(entry.itemId));
  expect(version?.data).toEqual({ title: 'Bohemian Forest', perex: 'We were there.', body: '<p>Forest</p>', note: '', code: 'SUM-1', km: 12 });
  expect((streamMock.mock.calls[0][0] as Prompt).system).toContain('from Čeština (cs) to English (en)');
  const usage = (await request(app).get('/ai/connection')).body.data.usage;
  expect(usage).toMatchObject({ requests: 1, inputTokens: 15, outputTokens: 6 });
});

it('cleans a plain text answer', async () => {
  await connect();
  const { entry } = await setup();
  answer({ ...translated, Perex: '```\n<b>We</b> were there.\n```' });
  const done = events((await translate(String(entry._id))).text).at(-1);
  expect((await ContentEntryModel.findById(done?.data.versionId).lean())?.data.perex).toBe('We were there.');
});

it('refuses before streaming when the entry or language does not fit', async () => {
  await connect();
  const { entry } = await setup();
  expect((await translate('nope')).status).toBe(400);
  expect((await translate(new mongoose.Types.ObjectId().toString())).status).toBe(404);
  expect((await translate(String(entry._id), 'de')).status).toBe(400);
  expect((await translate(String(entry._id), 'cs')).status).toBe(400);
  await createVersion(String(entry._id), 'en');
  const taken = await translate(String(entry._id));
  expect(taken.status).toBe(409);
  expect(taken.headers['content-type']).toContain('application/json');
  expect(taken.body.reason).toBe('VERSION_EXISTS');
  expect(streamMock).not.toHaveBeenCalled();
});

it('needs AI to be usable by this user', async () => {
  const { entry } = await setup();
  const notConnected = await translate(String(entry._id));
  expect(notConnected.status).toBe(409);
  expect(notConnected.body.reason).toBe('NOT_CONNECTED');
  await connect();
  expect((await request(app).post('/ai/translate').set('x-test-role', 'VIEWER').send({ entryId: String(entry._id), language: 'en' })).status).toBe(403);
  delete process.env.AI_KEY_SECRET;
  expect((await translate(String(entry._id))).status).toBe(503);
});

it('refuses a field over 16,000 characters before calling the AI', async () => {
  await connect();
  const { entry } = await setup({ perex: 'a'.repeat(16_001) });
  const list = events((await translate(String(entry._id))).text);
  expect(list.at(-1)).toEqual({ event: 'error', data: { code: 'TOO_LONG', field: 'perex', message: expect.any(String) } });
  expect(streamMock).not.toHaveBeenCalled();
  expect(await ContentEntryModel.countDocuments({ language: 'en' })).toBe(0);
  expect((await request(app).get('/ai/connection')).body.data.usage.requests).toBe(0);
});

it('fails when the answer is cut at the token cap and creates nothing', async () => {
  await connect();
  const { entry } = await setup();
  answer({ ...translated, Body: { text: '<p>For', truncated: true } });
  const list = events((await translate(String(entry._id))).text);
  expect(list.at(-1)).toEqual({ event: 'error', data: { code: 'TRUNCATED', field: 'body', message: expect.any(String) } });
  expect(await ContentEntryModel.countDocuments({ language: 'en' })).toBe(0);
  expect((await request(app).get('/ai/connection')).body.data.usage).toMatchObject({ requests: 1, inputTokens: 15, outputTokens: 6 });
});

it('stops at a provider error and names the field', async () => {
  await connect();
  const { entry } = await setup();
  answer({ ...translated, Perex: new AiProviderError('RATE_LIMIT', 'Slow down') });
  const list = events((await translate(String(entry._id))).text);
  expect(list.at(-1)).toEqual({ event: 'error', data: { code: 'RATE_LIMIT', message: 'Slow down', field: 'perex' } });
  expect(await ContentEntryModel.countDocuments({ language: 'en' })).toBe(0);
});

it('fails on an empty answer', async () => {
  await connect();
  const { entry } = await setup();
  answer({ ...translated, Perex: '  <img src="x">  ' });
  const list = events((await translate(String(entry._id))).text);
  expect(list.at(-1)).toEqual({ event: 'error', data: { code: 'PROVIDER', field: 'perex', message: expect.any(String) } });
  expect(await ContentEntryModel.countDocuments({ language: 'en' })).toBe(0);
});

it('reports VERSION_EXISTS when another request created the language meanwhile', async () => {
  await connect();
  const { entry } = await setup();
  answer({
    ...translated,
    Body: async () => {
      await ContentEntryModel.create({ contentTypeId: entry.contentTypeId, itemId: entry.itemId, language: 'en', data: {}, title: 'Racer', status: ContentStatus.DRAFT });
      return '<p>Forest</p>';
    },
  });
  const list = events((await translate(String(entry._id))).text);
  expect(list.at(-1)).toEqual({ event: 'error', data: { code: 'VERSION_EXISTS', message: expect.any(String) } });
  expect(await ContentEntryModel.countDocuments({ language: 'en' })).toBe(1);
});

it('copies the version when there is no text to translate', async () => {
  await connect();
  const { entry } = await setup({ title: '', perex: '', body: '' });
  const list = events((await translate(String(entry._id))).text);
  expect(list).toEqual([
    { event: 'start', data: { fields: [] } },
    { event: 'done', data: { versionId: expect.any(String), inputTokens: 0, outputTokens: 0 } },
  ]);
  expect(streamMock).not.toHaveBeenCalled();
  expect(await ContentEntryModel.countDocuments({ language: 'en' })).toBe(1);
  expect((await request(app).get('/ai/connection')).body.data.usage.requests).toBe(0);
});

it('stops when the client goes away and creates nothing', async () => {
  await connect();
  const { entry } = await setup();
  let seen: AbortSignal | undefined;
  const aborted = new Promise<void>((resolve) => {
    streamMock.mockImplementation(async (_prompt: unknown, signal: AbortSignal) => {
      seen = signal;
      await new Promise<void>((done) => signal.addEventListener('abort', () => done(), { once: true }));
      resolve();
      throw Object.assign(new Error('aborted'), { name: 'AbortError' });
    });
  });
  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  await new Promise<void>((resolve) => {
    const req = http.request({ port, path: '/ai/translate', method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
      let received = '';
      res.on('data', (chunk) => {
        received += String(chunk);
        if (received.includes('event: field')) {
          req.destroy();
          resolve();
        }
      });
    });
    req.end(JSON.stringify({ entryId: String(entry._id), language: 'en' }));
  });
  await aborted;
  expect(seen?.aborted).toBe(true);
  await new Promise((resolve) => setTimeout(resolve, 50));
  server.close();
  expect(await ContentEntryModel.countDocuments({ language: 'en' })).toBe(0);
  expect(streamMock).toHaveBeenCalledTimes(1);
  expect((await request(app).get('/ai/connection')).body.data.usage.requests).toBe(1);
});
