import request from 'supertest';
import { app } from '../../app';
import { useTestDb } from '../../test/db';

useTestDb();

it('does not accept a personal access token for the token endpoints', async () => {
  const res = await request(app).get('/api/v1/tokens').set('Authorization', 'Bearer tcms_pat_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG');
  expect(res.status).toBe(401);
});
