jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (req: { header(name: string): string | undefined; user?: unknown }, _res: unknown, next: () => void) => {
    req.user = { entraId: req.header('x-test-user') ?? 'user-a', email: 'a@test', role: 'EDITOR' };
    next();
  },
}));

import crypto from 'crypto';
import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { errorMiddleware } from '../../middleware/error.middleware';
import { AccessTokenModel } from '../../models/access-token.model';
import tokensRoutes from './tokens.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/tokens', tokensRoutes);
app.use(errorMiddleware);

const create = (body: object, user = 'user-a') => request(app).post('/tokens').set('x-test-user', user).send(body);

it('creates a token shown once and stores only its hash', async () => {
  const res = await create({ name: 'Laptop', expiresInDays: 30 });
  expect(res.status).toBe(201);
  const { token, prefix, expiresAt, name, expired } = res.body.data;
  expect(token).toMatch(/^tcms_pat_[A-Za-z0-9_-]{43}$/);
  expect(prefix).toBe(token.slice(0, 12));
  expect(name).toBe('Laptop');
  expect(expired).toBe(false);
  expect(Math.abs(new Date(expiresAt).getTime() - (Date.now() + 30 * 86_400_000))).toBeLessThan(60_000);
  const stored = await AccessTokenModel.findOne().lean();
  expect(stored?.hash).toBe(crypto.createHash('sha256').update(token).digest('hex'));
  expect(JSON.stringify(stored)).not.toContain(token);
  const list = await request(app).get('/tokens');
  expect(list.body.data).toHaveLength(1);
  expect(list.body.data[0]).not.toHaveProperty('token');
  expect(list.body.data[0]).toMatchObject({ name: 'Laptop', prefix });
});

it('lists only the caller tokens, newest first, and revokes only their own', async () => {
  await create({ name: 'First' });
  await create({ name: 'Second' });
  const other = await create({ name: 'Theirs' }, 'user-b');
  const mine = await request(app).get('/tokens');
  expect(mine.body.data.map((t: { name: string }) => t.name)).toEqual(['Second', 'First']);
  expect((await request(app).delete(`/tokens/${other.body.data.id}`)).status).toBe(404);
  expect((await request(app).delete('/tokens/nope')).status).toBe(404);
  expect((await request(app).delete(`/tokens/${mine.body.data[0].id}`)).status).toBe(204);
  expect((await request(app).get('/tokens')).body.data.map((t: { name: string }) => t.name)).toEqual(['First']);
  expect((await request(app).get('/tokens').set('x-test-user', 'user-b')).body.data).toHaveLength(1);
});

it('stops at 10 tokens; expired ones do not count', async () => {
  for (let i = 0; i < 10; i++) await create({ name: `T${i}` });
  const over = await create({ name: 'Eleven' });
  expect(over.status).toBe(409);
  expect(over.body.reason).toBe('TOKEN_LIMIT');
  await AccessTokenModel.updateOne({ name: 'T0' }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  expect((await create({ name: 'Eleven' })).status).toBe(201);
  const list = (await request(app).get('/tokens')).body.data as { name: string; expired: boolean }[];
  expect(list.find((t) => t.name === 'T0')?.expired).toBe(true);
});

it('checks the name and the expiry', async () => {
  expect((await create({ name: '' })).status).toBe(400);
  expect((await create({ name: 'x'.repeat(101) })).status).toBe(400);
  expect((await create({ name: 'Week', expiresInDays: 7 })).status).toBe(400);
  expect((await create({ name: 'Forever' })).body.data).not.toHaveProperty('expiresAt');
});
