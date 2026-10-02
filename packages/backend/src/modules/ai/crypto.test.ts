import { aiAvailable, decryptKey, encryptKey, keyHint } from './crypto';

const SECRET = Buffer.alloc(32, 7).toString('base64');

afterEach(() => {
  delete process.env.AI_KEY_SECRET;
});

it('encrypts a key so only this secret reads it back, with a fresh IV each time', () => {
  process.env.AI_KEY_SECRET = SECRET;
  const a = encryptKey('sk-ant-secret-1234');
  const b = encryptKey('sk-ant-secret-1234');
  expect(a.data).not.toContain('sk-ant');
  expect(a.iv).not.toBe(b.iv);
  expect(decryptKey(a)).toBe('sk-ant-secret-1234');
});

it('accepts a hex secret and refuses a secret of the wrong length', () => {
  process.env.AI_KEY_SECRET = 'ab'.repeat(32);
  expect(aiAvailable()).toBe(true);
  process.env.AI_KEY_SECRET = Buffer.alloc(16).toString('base64');
  expect(aiAvailable()).toBe(false);
});

it('reports AI as not available without a secret', () => {
  expect(aiAvailable()).toBe(false);
  expect(() => encryptKey('x')).toThrow(expect.objectContaining({ statusCode: 503, details: { reason: 'AI_NOT_AVAILABLE' } }));
});

it('asks to connect again when the secret changed', () => {
  process.env.AI_KEY_SECRET = SECRET;
  const stored = encryptKey('sk-ant-secret-1234');
  process.env.AI_KEY_SECRET = Buffer.alloc(32, 9).toString('base64');
  expect(() => decryptKey(stored)).toThrow(expect.objectContaining({ statusCode: 409, details: { reason: 'KEY_UNREADABLE' } }));
});

it('shows only the last 4 characters', () => {
  expect(keyHint('sk-ant-secret-1234')).toBe('1234');
});
