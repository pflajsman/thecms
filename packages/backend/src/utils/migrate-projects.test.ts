import { useTestDb } from '../test/db';
import { ContentTypeModel } from '../models/content-type.model';
import { ContentEntryModel } from '../models/content-entry.model';
import { LanguageModel } from '../models/language.model';
import { AccessTokenModel } from '../models/access-token.model';
import { ProjectModel } from '../models/project.model';
import { ProjectMemberModel } from '../models/project-member.model';
import { User, UserRole } from '../models/user.model';
import { DEFAULT_PROJECT_ID, migrateProjects } from './migrate-projects';
import { NoProjectContextError, setTestDefaultProject, withoutProject } from './project-context';

useTestDb();
setTestDefaultProject(null);

it('moves data from before projects into Default once, with memberships from the old roles', async () => {
  // An install from before projects: documents without projectId, users with global roles.
  const type = await ContentTypeModel.collection.insertOne({ name: 'Trip', slug: 'trip', fields: [], createdAt: new Date() });
  await ContentEntryModel.collection.insertOne({ contentTypeId: type.insertedId, data: { title: 'Old' }, title: 'Old', status: 'DRAFT' });
  await LanguageModel.collection.insertOne({ code: 'cs', name: 'Čeština', isDefault: true, order: 0 });
  await AccessTokenModel.collection.insertOne({ userId: 'admin', name: 'Old', hash: 'h', prefix: 'tcms_pat_abc' });
  await User.collection.insertMany([
    { entraId: 'admin', email: 'admin@example.com', role: UserRole.ADMIN },
    { entraId: 'editor', email: 'editor@example.com', role: UserRole.EDITOR },
  ]);

  const first = await migrateProjects();
  expect(first).toEqual({ createdDefault: true, backfilled: 3, memberships: 2 });

  await withoutProject(async () => {
    expect((await ContentTypeModel.find({ projectId: { $ne: DEFAULT_PROJECT_ID } }).lean()).map((t) => t.slug)).toEqual([]);
    // Default keeps its configured default language; the product model is seeded.
    expect((await LanguageModel.find().lean()).map((l) => l.code)).toEqual(['cs']);
    expect(await ContentTypeModel.exists({ system: 'product', projectId: DEFAULT_PROJECT_ID })).toBeTruthy();
    expect((await ContentEntryModel.findOne().lean())?.language).toBe('cs');
  });
  expect((await AccessTokenModel.findOne().lean())?.projectId).toEqual(DEFAULT_PROJECT_ID);
  const roles = (await ProjectMemberModel.find().lean()).map((m) => `${m.userId}:${m.role}`).sort();
  expect(roles).toEqual(['admin:OWNER', 'editor:EDITOR']);

  // Later: a role change and a newcomer are left alone by the next start.
  await ProjectMemberModel.updateOne({ userId: 'editor' }, { $set: { role: 'VIEWER' } });
  await User.create({ entraId: 'newcomer', email: 'new@example.com' });
  expect(await migrateProjects()).toEqual({ createdDefault: false, backfilled: 0, memberships: 0 });
  expect(await ProjectMemberModel.countDocuments({ userId: 'newcomer' })).toBe(0);
  expect((await ProjectMemberModel.findOne({ userId: 'editor' }).lean())?.role).toBe('VIEWER');
  expect(await ProjectModel.countDocuments()).toBe(1);
});

it('creates Default on a fresh install and seeds every project', async () => {
  await ProjectModel.create({ name: 'Client', createdBy: 'root' });
  await migrateProjects();
  // An install with projects already gets no Default; every project gets English and the product model.
  expect(await ProjectModel.exists({ _id: DEFAULT_PROJECT_ID })).toBeNull();
  expect(await withoutProject(() => LanguageModel.countDocuments({ code: 'en' }))).toBe(1);

  await ProjectModel.deleteMany({});
  await migrateProjects();
  expect(await ProjectModel.exists({ _id: DEFAULT_PROJECT_ID })).toBeTruthy();
});

it('two instances starting at once create one Default', async () => {
  const results = await Promise.allSettled([migrateProjects(), migrateProjects(), migrateProjects()]);
  expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled', 'fulfilled']);
  expect(await ProjectModel.countDocuments()).toBe(1);
  expect(await withoutProject(() => LanguageModel.countDocuments({ isDefault: true }))).toBe(1);
  expect(await withoutProject(() => ContentTypeModel.countDocuments({ system: 'product' }))).toBe(1);
});

it('refuses tenant queries outside a project in production code paths', async () => {
  await expect(ContentTypeModel.find()).rejects.toBeInstanceOf(NoProjectContextError);
});
