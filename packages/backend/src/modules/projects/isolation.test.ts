jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (req: { header(name: string): string | undefined; user?: unknown }, _res: unknown, next: () => void) => {
    const id = req.header('x-test-user') ?? 'root';
    req.user = { entraId: id, email: `${id}@example.com`, role: 'VIEWER', isSuperadmin: id === 'root' };
    next();
  },
}));
jest.mock('../../services/webhook.service', () => ({
  WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) },
}));

import request from 'supertest';
import { app } from '../../app';
import { useTestDb } from '../../test/db';
import { connectMcp, result } from '../../test/mcp-client';
import { FieldType } from '../../types/field-types';
import { ProjectMemberModel, ProjectRole } from '../../models/project-member.model';
import { ContentEntryModel } from '../../models/content-entry.model';
import { LanguageModel } from '../../models/language.model';
import { User } from '../../models/user.model';
import { TokensService } from '../tokens/tokens.service';
import { ProjectsService } from './projects.service';
import { setTestDefaultProject, withoutProject } from '../../utils/project-context';

useTestDb();
setTestDefaultProject(null);
jest.spyOn(console, 'error').mockImplementation(() => undefined);
jest.spyOn(console, 'info').mockImplementation(() => undefined);

const api = (user: string, project?: string) => {
  const withHeaders = (r: request.Test) => (project ? r.set('x-test-user', user).set('x-project-id', project) : r.set('x-test-user', user));
  return {
    get: (path: string) => withHeaders(request(app).get(`/api/v1${path}`)),
    post: (path: string, body: object) => withHeaders(request(app).post(`/api/v1${path}`)).send(body),
    put: (path: string, body: object) => withHeaders(request(app).put(`/api/v1${path}`)).send(body),
    delete: (path: string) => withHeaders(request(app).delete(`/api/v1${path}`)),
  };
};

async function project(name: string, members: Record<string, ProjectRole>) {
  const { id } = await ProjectsService.create({ name, createdBy: 'root' });
  for (const [userId, role] of Object.entries(members)) {
    await User.create({ entraId: userId, email: `${userId}@example.com` });
    await ProjectMemberModel.create({ projectId: id, userId, role });
  }
  return id;
}

/** Two projects with the same model slug, one published entry each, and a site key each. */
async function twoProjects() {
  const a = await project('Alpha', { anna: ProjectRole.OWNER, eva: ProjectRole.EDITOR, vik: ProjectRole.VIEWER });
  const b = await project('Beta', { bob: ProjectRole.OWNER });
  const seeded: Record<string, { typeId: string; entryId: string; apiKey: string }> = {};
  for (const [id, owner, title] of [[a, 'anna', 'Alpha trip'], [b, 'bob', 'Beta trip']]) {
    const type = await api(owner, id).post('/content-types', {
      name: 'Trip',
      slug: 'trip',
      fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: true }],
    });
    expect(type.status).toBe(201);
    const typeId = type.body.data.id ?? type.body.data._id;
    const entry = await api(owner, id).post(`/content-types/${typeId}/entries`, { data: { title } });
    expect(entry.status).toBe(201);
    const entryId = entry.body.data.id ?? entry.body.data._id;
    expect((await api(owner, id).put(`/entries/${entryId}/publish`, {})).status).toBe(200);
    const site = await api(owner, id).post('/sites', { name: `${title} site`, domain: `${owner}.example.com` });
    expect(site.status).toBe(201);
    seeded[id] = { typeId, entryId, apiKey: site.body.data.apiKey };
  }
  return { a, b, seeded };
}

it('refuses every admin area without a project, and outside the caller\'s projects', async () => {
  const { a, b } = await twoProjects();
  for (const path of ['/content-types', '/entries', '/media', '/sites', '/webhooks', '/contact-forms', '/submissions', '/stats', '/languages', '/commerce/products', '/commerce/orders', '/commerce/settings', '/tokens', '/members']) {
    expect([path, (await api('anna').get(path)).body.reason]).toEqual([path, 'PROJECT_REQUIRED']);
    expect([path, (await api('anna', b).get(path)).status]).toEqual([path, 403]);
  }
  expect((await api('anna', a).get('/stats')).status).toBe(200);
});

it('shows each project only its own data, even by id', async () => {
  const { a, b, seeded } = await twoProjects();
  const types = await api('anna', a).get('/content-types');
  expect(JSON.stringify(types.body)).not.toContain(seeded[b].typeId);
  const entries = await api('anna', a).get('/entries');
  expect(JSON.stringify(entries.body)).toContain('Alpha trip');
  expect(JSON.stringify(entries.body)).not.toContain('Beta trip');

  expect((await api('anna', a).get(`/entries/${seeded[b].entryId}`)).status).toBe(404);
  expect((await api('anna', a).put(`/entries/${seeded[b].entryId}`, { data: { title: 'Hacked' } })).status).toBe(404);
  expect((await api('anna', a).delete(`/content-types/${seeded[b].typeId}`)).status).toBe(404);
  const beta = await withoutProject(() => ContentEntryModel.findById(seeded[b].entryId).lean());
  expect(beta?.data).toEqual({ title: 'Beta trip' });

  // Each project got its own English default; codes are unique per project only.
  expect(await withoutProject(() => LanguageModel.countDocuments({ code: 'en', isDefault: true }))).toBe(2);
  expect((await api('anna', a).post('/content-types', { name: 'Trip', slug: 'trip', fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT }] })).status).toBe(409);
});

it('serves the public API from the site key\'s project only', async () => {
  const { a, b, seeded } = await twoProjects();
  const alpha = await request(app).get('/api/v1/public/content/trip').set('X-API-Key', seeded[a].apiKey);
  expect(alpha.status).toBe(200);
  expect(JSON.stringify(alpha.body)).toContain('Alpha trip');
  expect(JSON.stringify(alpha.body)).not.toContain('Beta trip');
  const cross = await request(app).get(`/api/v1/public/content/trip/${seeded[b].entryId}`).set('X-API-Key', seeded[a].apiKey);
  expect(cross.status).toBe(404);
});

it('lets a personal access token work in its own project only', async () => {
  const { a, b, seeded } = await twoProjects();
  const { token } = await TokensService.create('anna', a, { name: 'Agent' });
  const { client, close } = await connectMcp(token);
  const search = result(await client.callTool({ name: 'search_entries', arguments: { contentType: 'trip' } }));
  expect(JSON.stringify(search)).toContain('Alpha trip');
  expect(JSON.stringify(search)).not.toContain('Beta trip');
  const other = await client.callTool({ name: 'get_entry', arguments: { id: seeded[b].entryId } });
  expect(other.isError).toBe(true);
  await close();

  // Removed from the project: the token stops working.
  await ProjectMemberModel.deleteOne({ projectId: a, userId: 'anna' });
  expect(await TokensService.resolve(token)).toBeNull();
  expect(b).toBeDefined();
});

it('applies the role matrix to writes', async () => {
  const { a, seeded } = await twoProjects();
  const typeBody = { name: 'News', slug: 'news', fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT }] };
  expect((await api('vik', a).post(`/content-types/${seeded[a].typeId}/entries`, { data: { title: 'X' } })).status).toBe(403);
  expect((await api('vik', a).get('/entries')).status).toBe(200);
  expect((await api('eva', a).post(`/content-types/${seeded[a].typeId}/entries`, { data: { title: 'X' } })).status).toBe(201);
  expect((await api('eva', a).post('/content-types', typeBody)).status).toBe(403);
  expect((await api('eva', a).post('/languages', { code: 'cs', name: 'Čeština' })).status).toBe(403);
  expect((await api('eva', a).post('/sites', { name: 'S', domain: 's.example.com' })).status).toBe(403);
  expect((await api('eva', a).put('/commerce/settings', {})).status).toBe(403);
  expect((await api('anna', a).post('/content-types', typeBody)).status).toBe(201);
});
