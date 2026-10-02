import { guardedLookup } from './safe-fetch';

const prod = { NODE_ENV: 'production' } as NodeJS.ProcessEnv;
const dnsAnswer = (address: string) => ((_host: string, _opts: unknown, cb: (err: Error | null, addrs: { address: string; family: number }[]) => void) => cb(null, [{ address, family: 4 }])) as never;

function lookupWith(env: NodeJS.ProcessEnv, address: string, all: boolean) {
  return new Promise<{ err: Error | null; result: unknown }>((resolve) => {
    guardedLookup(env, dnsAnswer(address))('example.test', { all }, (err: Error | null, result: unknown) => resolve({ err, result }));
  });
}

it('refuses a connection whose name now resolves to a private address in production (DNS rebinding)', async () => {
  const { err } = await lookupWith(prod, '127.0.0.1', true);
  expect(err?.message).toMatch(/private/);
});

it('passes public addresses through, in both lookup styles', async () => {
  expect((await lookupWith(prod, '104.18.2.3', true)).result).toEqual([{ address: '104.18.2.3', family: 4 }]);
  expect((await lookupWith(prod, '104.18.2.3', false)).result).toBe('104.18.2.3');
});

it('allows private addresses in development', async () => {
  expect((await lookupWith({ NODE_ENV: 'development' } as NodeJS.ProcessEnv, '127.0.0.1', true)).err).toBeNull();
});
