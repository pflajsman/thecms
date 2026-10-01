import express from 'express';
import request from 'supertest';
import { configureTrustProxy, trustProxySetting } from './trust-proxy';

it('trusts one proxy hop in production, none elsewhere, and honours TRUST_PROXY', () => {
  expect(trustProxySetting({ NODE_ENV: 'production' })).toBe(1);
  expect(trustProxySetting({ NODE_ENV: 'development' })).toBe(false);
  expect(trustProxySetting({ NODE_ENV: 'production', TRUST_PROXY: '2' })).toBe(2);
  expect(trustProxySetting({ NODE_ENV: 'production', TRUST_PROXY: 'false' })).toBe(false);
});

it('takes the client address from X-Forwarded-For behind the proxy', async () => {
  const app = express();
  configureTrustProxy(app, { NODE_ENV: 'production' });
  app.get('/ip', (req, res) => res.json({ ip: req.ip }));
  const res = await request(app).get('/ip').set('X-Forwarded-For', '203.0.113.7');
  expect(res.body.ip).toBe('203.0.113.7');
});
