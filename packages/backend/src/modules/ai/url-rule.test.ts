import { checkBaseUrl, isPrivateAddress } from './url-rule';

const prod = { NODE_ENV: 'production' } as NodeJS.ProcessEnv;
const resolvesTo = (address: string) => async () => [{ address, family: address.includes(':') ? 6 : 4 }];

it('recognises loopback, private, link-local and unique-local addresses', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.10', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd12::1', 'fe80::1', '::ffff:10.0.0.1']) {
    expect([ip, isPrivateAddress(ip)]).toEqual([ip, true]);
  }
  for (const ip of ['8.8.8.8', '172.32.0.1', '2606:4700::1111']) expect([ip, isPrivateAddress(ip)]).toEqual([ip, false]);
});

it('allows a local Ollama address in development and trims the trailing slash', async () => {
  expect(await checkBaseUrl('http://localhost:11434/v1/', { NODE_ENV: 'development' } as NodeJS.ProcessEnv)).toBe('http://localhost:11434/v1');
});

it('refuses other schemes and malformed addresses', async () => {
  await expect(checkBaseUrl('ftp://example.com', prod)).rejects.toMatchObject({ statusCode: 400, details: { reason: 'BASE_URL' } });
  await expect(checkBaseUrl('not a url', prod)).rejects.toMatchObject({ statusCode: 400 });
});

it('refuses localhost, private IPs and names resolving to private addresses in production', async () => {
  await expect(checkBaseUrl('http://localhost:11434/v1', prod)).rejects.toMatchObject({ statusCode: 400 });
  await expect(checkBaseUrl('http://10.0.0.5/v1', prod)).rejects.toMatchObject({ statusCode: 400 });
  await expect(checkBaseUrl('https://looks-public.example/v1', prod, resolvesTo('192.168.0.7'))).rejects.toMatchObject({ statusCode: 400 });
  expect(await checkBaseUrl('https://openrouter.ai/api/v1', prod, resolvesTo('104.18.2.3'))).toBe('https://openrouter.ai/api/v1');
});

it('allows private addresses in production when AI_ALLOW_PRIVATE_URLS is true', async () => {
  expect(await checkBaseUrl('http://10.0.0.5/v1', { NODE_ENV: 'production', AI_ALLOW_PRIVATE_URLS: 'true' } as NodeJS.ProcessEnv)).toBe('http://10.0.0.5/v1');
});
