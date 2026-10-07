jest.mock('../../services/webhook.service', () => ({
  WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) },
}));

import { useTestDb } from '../../test/db';
import { connectMcp, result } from '../../test/mcp-client';
import { ProjectRole } from '../../models/project-member.model';
import { memberWithToken } from '../../test/projects';
import { LanguageModel } from '../../models/language.model';
import { ContentTypeModel } from '../../models/content-type.model';
import { FieldType } from '../../types/field-types';

useTestDb();

const MODEL_TOOLS = ['add_content_type_fields', 'create_content_type', 'create_language'];

async function setup(role: ProjectRole) {
  await LanguageModel.create({ code: 'en', name: 'English', isDefault: true, order: 0 });
  const token = await memberWithToken('agent-owner', role, 'Agent');
  return connectMcp(token);
}

const call = async (client: Awaited<ReturnType<typeof connectMcp>>['client'], name: string, args: Record<string, unknown>) => {
  const answer = await client.callTool({ name, arguments: args });
  return { isError: !!answer.isError, body: answer.isError ? (answer.content as { text: string }[])[0].text : result(answer) };
};

it('gives model tools to Admins and Owners only', async () => {
  await LanguageModel.create({ code: 'en', name: 'English', isDefault: true, order: 0 });
  const toolsOf = async (id: string, role: ProjectRole) => {
    const { client } = await connectMcp(await memberWithToken(id, role));
    return (await client.listTools()).tools.map((t) => t.name);
  };
  const editor = await toolsOf('editor', ProjectRole.EDITOR);
  expect(MODEL_TOOLS.filter((t) => editor.includes(t))).toEqual([]);
  expect(await toolsOf('admin', ProjectRole.ADMIN)).toEqual(expect.arrayContaining(MODEL_TOOLS));
  expect(await toolsOf('owner', ProjectRole.OWNER)).toEqual(expect.arrayContaining(MODEL_TOOLS));
});

it('adds a language after the existing ones without changing the default', async () => {
  const { client } = await setup(ProjectRole.ADMIN);
  const { body } = await call(client, 'create_language', { code: 'CS', name: 'Čeština' });
  expect(body).toEqual({ code: 'cs', name: 'Čeština', isDefault: false });
  expect((await call(client, 'create_language', { code: 'cs', name: 'Again' })).body).toBe("Language 'cs' already exists");
  expect((await call(client, 'create_language', { code: 'not a code', name: 'X' })).isError).toBe(true);
});

it('creates a content type with the admin validation', async () => {
  const { client } = await setup(ProjectRole.ADMIN);
  const { body } = await call(client, 'create_content_type', {
    name: 'Project',
    slug: 'project',
    titleField: 'title',
    fields: [
      { name: 'title', label: 'Title', type: 'TEXT', required: true },
      { name: 'cover', label: 'Cover', type: 'MEDIA' },
      { name: 'gallery', label: 'Gallery', type: 'MEDIA', validation: { multiple: true } },
    ],
  });
  expect(body).toMatchObject({
    slug: 'project',
    titleField: 'title',
    fields: [
      { name: 'title', type: 'TEXT', required: true, localized: true },
      { name: 'cover', type: 'MEDIA', required: false, localized: false },
      { name: 'gallery', validation: { multiple: true } },
    ],
  });

  const duplicate = await call(client, 'create_content_type', { name: 'Project', slug: 'project', fields: [{ name: 'title', label: 'Title', type: 'TEXT' }] });
  expect(duplicate).toEqual({ isError: true, body: "Content type with slug 'project' already exists" });

  const badTitle = await call(client, 'create_content_type', { name: 'Page', slug: 'page', titleField: 'nope', fields: [{ name: 'key', label: 'Key', type: 'TEXT' }] });
  expect(badTitle.isError).toBe(true);
  expect(badTitle.body).toContain('titleField');
  expect(await ContentTypeModel.countDocuments({ slug: 'page' })).toBe(0);
});

it('adds fields to a content type but never changes existing ones', async () => {
  await ContentTypeModel.create({ name: 'Page', slug: 'page', titleField: 'title', fields: [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: true }] });
  const { client } = await setup(ProjectRole.ADMIN);

  const { body } = await call(client, 'add_content_type_fields', { contentType: 'page', fields: [{ name: 'image', label: 'Image', type: 'MEDIA' }] });
  expect((body as { fields: { name: string }[] }).fields.map((f) => f.name)).toEqual(['title', 'image']);

  const clash = await call(client, 'add_content_type_fields', { contentType: 'page', fields: [{ name: 'title', label: 'Other', type: 'NUMBER' }] });
  expect(clash.isError).toBe(true);
  const stored = await ContentTypeModel.findOne({ slug: 'page' }).lean();
  expect(stored!.fields.find((f) => f.name === 'title')).toMatchObject({ label: 'Title', type: FieldType.TEXT });
});
