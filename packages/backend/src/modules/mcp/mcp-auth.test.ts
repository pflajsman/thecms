import request from 'supertest';
import { app } from '../../app';
import { useTestDb } from '../../test/db';
import { connectMcp, result } from '../../test/mcp-client';
import { User } from '../../models/user.model';
import { ProjectRole } from '../../models/project-member.model';
import { memberWithToken } from '../../test/projects';
import { AccessTokenModel } from '../../models/access-token.model';
import { LanguageModel } from '../../models/language.model';

useTestDb();

const initialize = { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } };
const post = (auth?: string) => {
  const r = request(app).post('/api/v1/mcp').set('Accept', 'application/json, text/event-stream');
  return (auth ? r.set('Authorization', auth) : r).send(initialize);
};

const userWithToken = (role = ProjectRole.EDITOR, entraId = 'user-a') => memberWithToken(entraId, role);

beforeEach(async () => {
  await LanguageModel.create({ code: 'en', name: 'English', isDefault: true, order: 0 });
});

it('signs in with a token and answers a tool call', async () => {
  const token = await userWithToken();
  const { client, close } = await connectMcp(token);
  expect((await client.listTools()).tools.map((t) => t.name)).toContain('list_languages');
  expect(result(await client.callTool({ name: 'list_languages', arguments: {} }))).toEqual({ languages: [{ code: 'en', name: 'English', isDefault: true }] });
  await close();
});

it('refuses missing, malformed, unknown, expired, revoked tokens and deleted owners', async () => {
  const token = await userWithToken();
  const refused = async (auth?: string) => {
    const res = await post(auth);
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ jsonrpc: '2.0', error: { code: -32001 }, id: null });
  };
  await refused();
  await refused('Basic abc');
  await refused('Bearer not-a-token');
  await refused(`Bearer ${token}x`);
  expect((await post(`Bearer ${token}`)).status).toBe(200);

  await AccessTokenModel.updateOne({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  await refused(`Bearer ${token}`);
  await AccessTokenModel.updateOne({}, { $unset: { expiresAt: '' } });
  await User.deleteOne({ entraId: 'user-a' });
  await refused(`Bearer ${token}`);
  await User.create({ entraId: 'user-a', email: 'user-a@test.cz' });
  await AccessTokenModel.deleteMany({});
  await refused(`Bearer ${token}`);
});

it('answers 405 to GET and DELETE', async () => {
  const token = await userWithToken();
  expect((await request(app).get('/api/v1/mcp').set('Authorization', `Bearer ${token}`)).status).toBe(405);
  expect((await request(app).delete('/api/v1/mcp').set('Authorization', `Bearer ${token}`)).status).toBe(405);
});

it('records the last use at most once a minute', async () => {
  const token = await userWithToken();
  await post(`Bearer ${token}`);
  const first = (await AccessTokenModel.findOne().lean())?.lastUsedAt;
  expect(first).toBeInstanceOf(Date);
  await post(`Bearer ${token}`);
  expect((await AccessTokenModel.findOne().lean())?.lastUsedAt?.getTime()).toBe(first?.getTime());
});

it('logs each tool call with the token prefix and no content', async () => {
  const token = await userWithToken();
  const info = jest.spyOn(console, 'info').mockImplementation(() => undefined);
  const { client, close } = await connectMcp(token);
  await client.callTool({ name: 'list_languages', arguments: {} });
  await close();
  expect(info).toHaveBeenCalledWith(`mcp ${token.slice(0, 12)} list_languages ok`);
  expect(JSON.stringify(info.mock.calls)).not.toContain(token);
  info.mockRestore();
});

it('limits requests per token', async () => {
  process.env.MCP_REQUESTS_PER_MINUTE = '2';
  try {
    const a = await userWithToken(ProjectRole.EDITOR, 'user-a');
    const b = await userWithToken(ProjectRole.EDITOR, 'user-b');
    expect((await post(`Bearer ${a}`)).status).toBe(200);
    expect((await post(`Bearer ${a}`)).status).toBe(200);
    const limited = await post(`Bearer ${a}`);
    expect(limited.status).toBe(429);
    expect(limited.body).toMatchObject({ jsonrpc: '2.0', error: { code: -32000 } });
    expect((await post(`Bearer ${b}`)).status).toBe(200);
  } finally {
    delete process.env.MCP_REQUESTS_PER_MINUTE;
  }
});

it('refuses JSON-RPC batches, so one request is one call', async () => {
  const token = await userWithToken();
  const call = (id: number) => ({ jsonrpc: '2.0', id, method: 'tools/call', params: { name: 'list_languages', arguments: {} } });
  const res = await request(app)
    .post('/api/v1/mcp')
    .set('Accept', 'application/json, text/event-stream')
    .set('Authorization', `Bearer ${token}`)
    .send([call(1), call(2)]);
  expect(res.status).toBe(400);
  expect(res.body).toMatchObject({ jsonrpc: '2.0', error: { code: -32600 }, id: null });
});
