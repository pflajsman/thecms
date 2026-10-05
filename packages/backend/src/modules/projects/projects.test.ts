jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (req: { header(name: string): string | undefined; user?: unknown }, _res: unknown, next: () => void) => {
    const id = req.header('x-test-user') ?? 'root';
    req.user = { entraId: id, email: `${id}@example.com`, displayName: id, role: 'VIEWER', isSuperadmin: id === 'root' };
    next();
  },
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { setTestDefaultProject } from '../../utils/project-context';
import { apiRoutes } from '../../routes';
import { errorMiddleware } from '../../middleware/error.middleware';
import { InvitationModel } from '../../models/invitation.model';
import { ProjectMemberModel, ProjectRole } from '../../models/project-member.model';
import { User } from '../../models/user.model';

useTestDb();
setTestDefaultProject(null);
jest.spyOn(console, 'error').mockImplementation(() => undefined);

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);
app.use(errorMiddleware);

const as = (user: string) => ({
  get: (path: string, project?: string) => withProject(request(app).get(`/api${path}`).set('x-test-user', user), project),
  post: (path: string, body: object, project?: string) => withProject(request(app).post(`/api${path}`).set('x-test-user', user), project).send(body),
  patch: (path: string, body: object, project?: string) => withProject(request(app).patch(`/api${path}`).set('x-test-user', user), project).send(body),
  delete: (path: string, project?: string) => withProject(request(app).delete(`/api${path}`).set('x-test-user', user), project),
});
const withProject = (req: request.Test, project?: string) => (project ? req.set('x-project-id', project) : req);
const tokenOf = (url: string) => url.split('/invite/')[1];

/** A project owned by `owner` (who accepted the superadmin's invitation). */
async function projectOwnedBy(owner: string, name = 'Client'): Promise<string> {
  const created = await as('root').post('/projects', { name, ownerEmail: `${owner}@example.com` });
  expect(created.status).toBe(201);
  const accepted = await as(owner).post(`/invites/${tokenOf(created.body.data.inviteUrl)}/accept`, {});
  expect(accepted.status).toBe(200);
  return created.body.data.project.id;
}

async function addMember(project: string, by: string, user: string, role: ProjectRole) {
  const invited = await as(by).post('/invitations', { email: `${user}@example.com`, role }, project);
  expect(invited.status).toBe(201);
  expect((await as(user).post(`/invites/${tokenOf(invited.body.data.inviteUrl)}/accept`, {})).status).toBe(200);
}

it('lets only a superadmin create and list projects', async () => {
  expect((await as('alice').post('/projects', { name: 'X', ownerEmail: 'a@example.com' })).status).toBe(403);
  expect((await as('alice').get('/projects')).status).toBe(403);
  const project = await projectOwnedBy('alice');
  const list = await as('root').get('/projects');
  expect(list.body.data).toEqual([expect.objectContaining({ id: project, name: 'Client', memberCount: 1, status: 'active' })]);
});

it('gives a new user no projects until they accept an invitation', async () => {
  expect((await as('stranger').get('/users/me')).body.data).toMatchObject({ isSuperadmin: false, projects: [] });
  const project = await projectOwnedBy('alice');
  expect((await as('alice').get('/users/me')).body.data.projects).toEqual([{ id: project, name: 'Client', role: 'OWNER' }]);
  expect((await as('root').get('/users/me')).body.data).toMatchObject({ isSuperadmin: true, projects: [{ id: project, role: 'OWNER' }] });
});

it('accepts an invitation link once, before it expires', async () => {
  await User.create({ entraId: 'root', email: 'root@example.com', displayName: 'Root Admin', isSuperadmin: true });
  const created = await as('root').post('/projects', { name: 'Client', ownerEmail: 'owner@example.com' });
  const token = tokenOf(created.body.data.inviteUrl);
  expect((await as('bob').get(`/invites/${token}`)).body.data).toMatchObject({ projectName: 'Client', role: 'OWNER', invitedByName: 'Root Admin' });
  expect((await as('bob').post(`/invites/${token}/accept`, {})).status).toBe(200);
  expect((await as('carol').post(`/invites/${token}/accept`, {})).status).toBe(410);
  expect((await as('carol').get('/invites/not-a-token')).status).toBe(410);

  const project = created.body.data.project.id;
  const invited = await as('bob').post('/invitations', { email: 'dave@example.com', role: 'EDITOR' }, project);
  await InvitationModel.updateOne({ _id: invited.body.data.invitation.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  expect((await as('dave').post(`/invites/${tokenOf(invited.body.data.inviteUrl)}/accept`, {})).status).toBe(410);
});

it('requires a project the caller belongs to and that is active', async () => {
  const project = await projectOwnedBy('alice');
  expect((await as('alice').get('/members')).body.reason).toBe('PROJECT_REQUIRED');
  expect((await as('mallory').get('/members', project)).status).toBe(403);
  expect((await as('alice').get('/members', 'not-an-id')).status).toBe(403);
  await as('root').patch(`/projects/${project}`, { status: 'archived' });
  expect((await as('alice').get('/members', project)).status).toBe(403);
  expect((await as('root').get('/members', project)).status).toBe(200);
});

it('lets an Admin manage Editors and Viewers and invite Admins, but not touch Admins or Owners', async () => {
  const project = await projectOwnedBy('alice');
  await addMember(project, 'alice', 'adam', ProjectRole.ADMIN);
  await addMember(project, 'adam', 'erin', ProjectRole.EDITOR);
  await addMember(project, 'adam', 'ann', ProjectRole.ADMIN);

  expect((await as('adam').post('/invitations', { email: 'x@example.com', role: 'OWNER' }, project)).status).toBe(403);
  expect((await as('adam').patch('/members/erin', { role: 'VIEWER' }, project)).status).toBe(204);
  expect((await as('adam').patch('/members/ann', { role: 'EDITOR' }, project)).status).toBe(403);
  expect((await as('adam').delete('/members/alice', project)).status).toBe(403);
  expect((await as('erin').get('/members', project)).status).toBe(403);
  expect((await as('erin').post('/invitations', { email: 'x@example.com', role: 'VIEWER' }, project)).status).toBe(403);

  expect((await as('alice').patch('/members/ann', { role: 'EDITOR' }, project)).status).toBe(204);
  const list = await as('adam').get('/members', project);
  expect(list.body.data.members.map((m: { userId: string; role: string }) => `${m.userId}:${m.role}`)).toEqual([
    'alice:OWNER', 'adam:ADMIN', 'ann:EDITOR', 'erin:VIEWER',
  ]);
});

it('keeps at least one Owner and lets members leave', async () => {
  const project = await projectOwnedBy('alice');
  await addMember(project, 'alice', 'erin', ProjectRole.EDITOR);
  expect((await as('alice').delete('/members/alice', project)).body.reason).toBe('LAST_OWNER');
  expect((await as('alice').patch('/members/alice', { role: 'ADMIN' }, project)).body.reason).toBe('LAST_OWNER');
  expect((await as('erin').delete('/members/erin', project)).status).toBe(204);
  expect(await ProjectMemberModel.countDocuments({ projectId: project })).toBe(1);
});

it('reissues an open invitation for the same email and revokes it', async () => {
  const project = await projectOwnedBy('alice');
  const first = await as('alice').post('/invitations', { email: 'Erin@Example.com', role: 'VIEWER' }, project);
  const second = await as('alice').post('/invitations', { email: 'erin@example.com', role: 'EDITOR' }, project);
  expect(second.body.data.invitation.id).toBe(first.body.data.invitation.id);
  expect((await as('erin').post(`/invites/${tokenOf(first.body.data.inviteUrl)}/accept`, {})).status).toBe(410);

  const list = await as('alice').get('/members', project);
  expect(list.body.data.invitations).toEqual([expect.objectContaining({ email: 'erin@example.com', role: 'EDITOR', expired: false })]);
  expect((await as('alice').delete(`/invitations/${first.body.data.invitation.id}`, project)).status).toBe(204);
  expect((await as('erin').post(`/invites/${tokenOf(second.body.data.inviteUrl)}/accept`, {})).status).toBe(410);
});

it('lets only an Owner rename the project, and never across projects', async () => {
  const project = await projectOwnedBy('alice');
  const other = await projectOwnedBy('olga', 'Other');
  await addMember(project, 'alice', 'adam', ProjectRole.ADMIN);
  expect((await as('adam').patch('/project', { name: 'New' }, project)).status).toBe(403);
  expect((await as('alice').patch('/project', { name: 'New' }, project)).body.data.name).toBe('New');
  expect((await as('alice').get('/members', other)).status).toBe(403);
  expect((await as('alice').delete('/members/olga', project)).status).toBe(404);
});
