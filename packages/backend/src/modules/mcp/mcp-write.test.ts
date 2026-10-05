jest.mock('../../services/webhook.service', () => ({
  WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) },
}));

import { useTestDb } from '../../test/db';
import { connectMcp, result } from '../../test/mcp-client';
import { ProjectMemberModel, ProjectRole } from '../../models/project-member.model';
import { memberWithToken } from '../../test/projects';
import { LanguageModel } from '../../models/language.model';
import { ContentTypeModel } from '../../models/content-type.model';
import { ContentEntryModel, ContentStatus } from '../../models/content-entry.model';
import { FieldType } from '../../types/field-types';
import { ContentEntriesService } from '../content-entries/content-entries.service';
import { createVersion } from '../content-entries/entry-versions.service';

useTestDb();

async function setup(role = ProjectRole.EDITOR) {
  await LanguageModel.create([
    { code: 'en', name: 'English', isDefault: true, order: 0 },
    { code: 'cs', name: 'Čeština', isDefault: false, order: 1 },
  ]);
  const type = await ContentTypeModel.create({
    name: 'Trip',
    slug: 'trip',
    titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: FieldType.TEXT, required: true },
      { name: 'perex', label: 'Perex', type: FieldType.TEXT, required: false },
      { name: 'km', label: 'Distance', type: FieldType.NUMBER, required: false },
    ],
  });
  const token = await memberWithToken('agent-owner', role, 'Agent');
  return { type, token };
}

const names = async (client: Awaited<ReturnType<typeof connectMcp>>['client']) => (await client.listTools()).tools.map((t) => t.name).sort();

it('gives Editors the draft tools and never a publish or delete tool', async () => {
  const { token } = await setup();
  const { client, close } = await connectMcp(token);
  expect(await names(client)).toEqual(['create_entry', 'create_language_version', 'get_entry', 'list_content_types', 'list_languages', 'list_media', 'search_entries', 'update_draft']);
  await close();
});

it('a Viewer gets read tools only, even with an older token', async () => {
  const { token } = await setup();
  await ProjectMemberModel.updateOne({ userId: 'agent-owner' }, { $set: { role: ProjectRole.VIEWER } });
  const { client, close } = await connectMcp(token);
  expect(await names(client)).toEqual(['get_entry', 'list_content_types', 'list_languages', 'list_media', 'search_entries']);
  const call = await client.callTool({ name: 'create_entry', arguments: { contentType: 'trip', data: { title: 'X' } } }).catch((e: unknown) => ({ isError: true, thrown: String(e) }));
  expect(call.isError).toBe(true);
  expect(await ContentEntryModel.countDocuments()).toBe(0);
  await close();
});

it('creates entries as drafts in the default or given language', async () => {
  const { token } = await setup();
  const { client, close } = await connectMcp(token);
  const created = result(await client.callTool({ name: 'create_entry', arguments: { contentType: 'trip', data: { title: 'Ridge walk', km: 12 } } }));
  expect(created).toMatchObject({ contentType: 'trip', language: 'en', status: 'DRAFT', title: 'Ridge walk', data: { title: 'Ridge walk', km: 12 } });
  const czech = result(await client.callTool({ name: 'create_entry', arguments: { contentType: 'trip', language: 'cs', data: { title: 'Hřebenovka' } } }));
  expect(czech).toMatchObject({ language: 'cs', status: 'DRAFT' });
  await close();
});

it('changes a draft by merging the given fields', async () => {
  const { token, type } = await setup();
  const draft = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'Ridge', perex: 'Short', km: 12 } });
  const { client, close } = await connectMcp(token);
  const updated = result(await client.callTool({ name: 'update_draft', arguments: { id: String(draft._id), data: { title: 'Ridge walk' } } }));
  expect(updated).toMatchObject({ title: 'Ridge walk', status: 'DRAFT', data: { title: 'Ridge walk', perex: 'Short', km: 12 } });
  await close();
});

it('refuses to change published and archived versions', async () => {
  const { token, type } = await setup();
  const live = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'Live' } });
  await ContentEntriesService.publishEntry(String(live._id));
  const old = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'Old' } });
  await ContentEntriesService.archiveEntry(String(old._id));
  const { client, close } = await connectMcp(token);
  for (const [entry, word] of [[live, 'published'], [old, 'archived']] as const) {
    const call = await client.callTool({ name: 'update_draft', arguments: { id: String(entry._id), data: { title: 'Changed' } } });
    expect(call.isError).toBe(true);
    expect(JSON.stringify(call.content)).toContain(`This version is ${word}. Only drafts can be changed through MCP`);
  }
  expect((await ContentEntryModel.findById(live._id).lean())?.data).toEqual({ title: 'Live' });
  await close();
});

it('returns validation errors as tool errors and leaves the draft alone', async () => {
  const { token, type } = await setup();
  const draft = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'Ridge' } });
  const { client, close } = await connectMcp(token);
  const empty = await client.callTool({ name: 'update_draft', arguments: { id: String(draft._id), data: { title: '' } } });
  expect(empty.isError).toBe(true);
  expect(JSON.stringify(empty.content)).toContain('Title is required');
  expect((await ContentEntryModel.findById(draft._id).lean())?.data).toEqual({ title: 'Ridge' });
  const missing = await client.callTool({ name: 'create_entry', arguments: { contentType: 'trip', data: { km: 3 } } });
  expect(missing.isError).toBe(true);
  expect((await client.callTool({ name: 'update_draft', arguments: { id: 'nope', data: {} } })).isError).toBe(true);
  await close();
});

it('creates a language version with translated fields and shared values copied', async () => {
  const { token, type } = await setup();
  const en = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'Ridge walk', perex: 'Up high', km: 12 } });
  await ContentEntriesService.publishEntry(String(en._id));
  const { client, close } = await connectMcp(token);
  const cs = result(await client.callTool({ name: 'create_language_version', arguments: { id: String(en._id), language: 'cs', data: { title: 'Hřebenovka', perex: 'Vysoko' } } }));
  expect(cs).toMatchObject({ language: 'cs', status: 'DRAFT', title: 'Hřebenovka', data: { title: 'Hřebenovka', perex: 'Vysoko', km: 12 }, itemId: String(en.itemId) });
  const again = await client.callTool({ name: 'create_language_version', arguments: { id: String(en._id), language: 'cs' } });
  expect(again.isError).toBe(true);
  expect(JSON.stringify(again.content)).toContain('already exists');
  expect((await ContentEntryModel.findById(en._id).lean())?.status).toBe(ContentStatus.PUBLISHED);
  await close();
});

it('never changes a published version through a shared field', async () => {
  const { token, type } = await setup();
  const en = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'Ridge walk', km: 12 } });
  await ContentEntriesService.publishEntry(String(en._id));
  const cs = await createVersion(String(en._id), 'cs');
  const { client, close } = await connectMcp(token);
  const shared = await client.callTool({ name: 'update_draft', arguments: { id: String(cs._id), data: { km: 99 } } });
  expect(shared.isError).toBe(true);
  expect(JSON.stringify(shared.content)).toContain('Distance is shared by all language versions');
  expect((await ContentEntryModel.findById(en._id).lean())?.data).toEqual({ title: 'Ridge walk', km: 12 });
  expect((await ContentEntryModel.findById(cs._id).lean())?.data).toEqual({ title: 'Ridge walk', km: 12 });
  const translated = await client.callTool({ name: 'update_draft', arguments: { id: String(cs._id), data: { title: 'Hřebenovka', km: 12 } } });
  expect(translated.isError).toBeFalsy();
  expect((await ContentEntryModel.findById(en._id).lean())?.data).toEqual({ title: 'Ridge walk', km: 12 });
  await close();
});

it('keeps shared values when creating a language version', async () => {
  const { token, type } = await setup();
  const en = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'Ridge walk', km: 12 } });
  const { client, close } = await connectMcp(token);
  const call = await client.callTool({ name: 'create_language_version', arguments: { id: String(en._id), language: 'cs', data: { title: 'Hřebenovka', km: 99 } } });
  expect(call.isError).toBe(true);
  expect(JSON.stringify(call.content)).toContain('Distance is shared by all language versions');
  expect(await ContentEntryModel.countDocuments({ language: 'cs' })).toBe(0);
  await close();
});

it('refuses field names the content type does not have', async () => {
  const { token, type } = await setup();
  const draft = await ContentEntriesService.createEntry({ contentTypeId: String(type._id), data: { title: 'Ridge' } });
  const { client, close } = await connectMcp(token);
  const update = await client.callTool({ name: 'update_draft', arguments: { id: String(draft._id), data: { titel: 'Ridge walk' } } });
  expect(update.isError).toBe(true);
  expect(JSON.stringify(update.content)).toContain("Unknown field 'titel'");
  expect((await ContentEntryModel.findById(draft._id).lean())?.data).toEqual({ title: 'Ridge' });
  const create = await client.callTool({ name: 'create_entry', arguments: { contentType: 'trip', data: { title: 'X', colour: 'red' } } });
  expect(create.isError).toBe(true);
  expect(JSON.stringify(create.content)).toContain("Unknown field 'colour'");
  await close();
});
