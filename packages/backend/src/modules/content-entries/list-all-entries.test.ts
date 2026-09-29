jest.mock('../../services/webhook.service', () => ({
  WebhookService: { triggerEvent: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { ContentEntriesService } from './content-entries.service';
import { ContentTypeModel } from '../../models/content-type.model';
import { ContentStatus } from '../../models/content-entry.model';
import { FieldType } from '../../types/field-types';
import entriesRoutes from './content-entries.routes';

useTestDb();

const app = express();
app.use(express.json());
app.use('/entries', entriesRoutes);

async function seed() {
  const fields = [{ name: 'title', label: 'Title', type: FieldType.TEXT, required: false }];
  const post = await ContentTypeModel.create({ name: 'Blog post', slug: 'blog-post', fields });
  const trip = await ContentTypeModel.create({ name: 'Trip', slug: 'trip', fields });
  const mk = (typeId: string, title: string, status = ContentStatus.DRAFT) =>
    ContentEntriesService.createEntry({ contentTypeId: typeId, data: { title }, status });
  await mk(post.id, 'Jak jsem stavěl CMS');
  await mk(post.id, 'C++ (draft) notes');
  await mk(trip.id, 'Přes Šumavu na kole', ContentStatus.PUBLISHED);
  await mk(trip.id, 'Krkonoše 2026');
  return { post, trip };
}

describe('ContentEntriesService.listAllEntries', () => {
  it('lists entries across all types with content type info', async () => {
    await seed();
    const res = await ContentEntriesService.listAllEntries({});
    expect(res.pagination.total).toBe(4);
    expect(res.entries[0].contentType).toEqual(
      expect.objectContaining({ name: expect.any(String), slug: expect.any(String) })
    );
  });

  it('filters by one or more content types', async () => {
    const { trip, post } = await seed();
    expect((await ContentEntriesService.listAllEntries({ contentTypeIds: [trip.id] })).pagination.total).toBe(2);
    expect(
      (await ContentEntriesService.listAllEntries({ contentTypeIds: [trip.id, post.id] })).pagination.total
    ).toBe(4);
  });

  it('filters by status', async () => {
    await seed();
    const res = await ContentEntriesService.listAllEntries({ status: ContentStatus.PUBLISHED });
    expect(res.entries.map((e) => e.title)).toEqual(['Přes Šumavu na kole']);
  });

  it('searches title case-insensitively', async () => {
    await seed();
    const res = await ContentEntriesService.listAllEntries({ search: 'šumavu' });
    expect(res.entries.map((e) => e.title)).toEqual(['Přes Šumavu na kole']);
  });

  it('treats regex characters in search literally', async () => {
    await seed();
    const res = await ContentEntriesService.listAllEntries({ search: 'C++ (draft)' });
    expect(res.entries.map((e) => e.title)).toEqual(['C++ (draft) notes']);
  });

  it('sorts by title ascending and paginates', async () => {
    await seed();
    const page1 = await ContentEntriesService.listAllEntries({ sortBy: 'title', sortOrder: 'asc', limit: 2, page: 1 });
    const page2 = await ContentEntriesService.listAllEntries({ sortBy: 'title', sortOrder: 'asc', limit: 2, page: 2 });
    expect(page1.entries.map((e) => e.title)).toEqual(['C++ (draft) notes', 'Jak jsem stavěl CMS']);
    expect(page2.entries.map((e) => e.title)).toEqual(['Krkonoše 2026', 'Přes Šumavu na kole']);
    expect(page1.pagination.totalPages).toBe(2);
  });

  it('returns contentType null for entries whose type was deleted', async () => {
    const { trip } = await seed();
    await ContentTypeModel.deleteOne({ _id: trip._id });
    const res = await ContentEntriesService.listAllEntries({});
    expect(res.pagination.total).toBe(4);
    expect(res.entries.filter((e) => e.contentType === null)).toHaveLength(2);
  });
});

describe('GET /entries', () => {
  it('is routed to the list handler, not /:id', async () => {
    await seed();
    const res = await request(app).get('/entries?limit=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(4);
  });

  it('accepts repeated contentTypeId params', async () => {
    const { trip, post } = await seed();
    const res = await request(app).get(`/entries?contentTypeId=${trip.id}&contentTypeId=${post.id}`);
    expect(res.status).toBe(200);
    expect(res.body.pagination.total).toBe(4);
  });

  it('rejects an invalid contentTypeId with 400', async () => {
    const res = await request(app).get('/entries?contentTypeId=not-an-id');
    expect(res.status).toBe(400);
  });

  it('rejects search longer than 100 characters with 400', async () => {
    const res = await request(app).get(`/entries?search=${'a'.repeat(101)}`);
    expect(res.status).toBe(400);
  });

  it('rejects an unknown sortBy with 400', async () => {
    const res = await request(app).get('/entries?sortBy=data.secret');
    expect(res.status).toBe(400);
  });
});
