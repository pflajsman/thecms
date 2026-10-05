import express from 'express';
import request from 'supertest';
import webhooksRoutes from './webhooks.routes';
import { errorMiddleware } from '../../middleware/error.middleware';

const app = express();
app.use(express.json());
app.use('/webhooks', webhooksRoutes);
app.use(errorMiddleware);

it.each([
  ['get', '/webhooks'],
  ['post', '/webhooks'],
  ['get', '/webhooks/507f1f77bcf86cd799439011'],
  ['put', '/webhooks/507f1f77bcf86cd799439011'],
  ['delete', '/webhooks/507f1f77bcf86cd799439011'],
  ['post', '/webhooks/507f1f77bcf86cd799439011/test'],
  ['post', '/webhooks/507f1f77bcf86cd799439011/rotate-secret'],
  ['get', '/webhooks/507f1f77bcf86cd799439011/logs'],
] as const)('refuses %s %s without a token', async (method, path) => {
  const res = await request(app)[method](path);
  expect(res.status).toBe(401);
});
