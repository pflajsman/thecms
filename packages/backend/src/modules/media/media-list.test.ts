jest.mock('../../middleware/auth.middleware', () => ({
  ...jest.requireActual('../../middleware/auth.middleware'),
  authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import express from 'express';
import request from 'supertest';
import { useTestDb } from '../../test/db';
import { MediaModel } from '../../models/media.model';
import { MediaService } from './media.service';
import mediaRoutes from './media.routes';

useTestDb();

const app = express();
app.use('/media', mediaRoutes);

async function seed() {
  const base = { mimeType: 'image/jpeg', size: 10, blobUrl: 'http://x/a.jpg' };
  const a = await MediaModel.create({ ...base, filename: 'a.jpg', originalName: 'photo (1).jpg' });
  const b = await MediaModel.create({ ...base, filename: 'b.jpg', originalName: 'Šumava.jpg', altText: 'Forest trail' });
  const c = await MediaModel.create({ ...base, filename: 'c.gpx', originalName: 'route.gpx', mimeType: 'application/gpx+xml', tags: ['bike'] });
  return { a, b, c };
}

describe('MediaService.listMedia', () => {
  it('returns only the requested ids', async () => {
    const { a, c } = await seed();
    const res = await MediaService.listMedia({ ids: [a.id, c.id, '66f1a2b3c4d5e6f7a8b9c0d1'] });
    expect(res.media.map((m) => m.id).sort()).toEqual([a.id, c.id].sort());
  });

  it('searches names literally and case-insensitively', async () => {
    await seed();
    expect((await MediaService.listMedia({ search: 'photo (1)' })).media.map((m) => m.originalName)).toEqual(['photo (1).jpg']);
    expect((await MediaService.listMedia({ search: 'šumava' })).media).toHaveLength(1);
  });

  it('searches alt text, description and tags', async () => {
    await seed();
    expect((await MediaService.listMedia({ search: 'forest' })).media.map((m) => m.originalName)).toEqual(['Šumava.jpg']);
    expect((await MediaService.listMedia({ search: 'bike' })).media.map((m) => m.originalName)).toEqual(['route.gpx']);
  });
});

describe('GET /media', () => {
  it('accepts comma-separated ids', async () => {
    const { a, b } = await seed();
    const res = await request(app).get(`/media?ids=${a.id},${b.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
  });

  it('rejects malformed ids and overlong search with 400', async () => {
    expect((await request(app).get('/media?ids=nope')).status).toBe(400);
    expect((await request(app).get(`/media?search=${'a'.repeat(101)}`)).status).toBe(400);
  });
});

describe('document category', () => {
  it('includes every non-image, non-video, non-GPX type', async () => {
    const base = { size: 10, blobUrl: 'http://x/f' };
    const types: [string, string][] = [
      ['application/pdf', 'a.pdf'],
      ['application/msword', 'b.doc'],
      ['application/vnd.ms-excel', 'c.xls'],
      ['application/vnd.ms-powerpoint', 'd.ppt'],
      ['text/xml', 'e.xml'],
      ['image/png', 'f.png'],
      ['video/mp4', 'g.mp4'],
      ['application/gpx+xml', 'h.gpx'],
      ['application/xml', 'i.gpx'],
    ];
    for (const [mimeType, name] of types) {
      await MediaModel.create({ ...base, mimeType, filename: name, originalName: name });
    }
    const res = await MediaService.listMedia({ category: 'document', limit: 100 });
    expect(res.media.map((m) => m.originalName).sort()).toEqual(['a.pdf', 'b.doc', 'c.xls', 'd.ppt', 'e.xml']);
  });
});
