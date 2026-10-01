import { vi } from 'vitest';

export interface MockResult {
  status?: number;
  body: unknown;
}
type Handler = (body: never, url: URL) => MockResult | Promise<MockResult>;

export const ok = (data: unknown, status = 200): MockResult => ({ status, body: { success: true, data } });

const defaults: Record<string, Handler> = {
  'GET /shop/settings': () => ok({ currencies: [{ code: 'CZK', decimals: 2 }], defaultCurrency: 'CZK' }),
};

function matches(pattern: string, key: string): boolean {
  return new RegExp(`^${pattern.replace(/:[^/\s]+/g, '[^/]+')}$`).test(key);
}

/** Replaces fetch with handlers keyed by "METHOD /path" (the path after the public API prefix). A handler may throw to simulate a network failure. */
export function mockApi(routes: Record<string, Handler>) {
  const all = { ...defaults, ...routes };
  const calls: { key: string; url: URL; body: unknown; headers: Headers }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init = {}) => {
    const url = new URL(String(input));
    const key = `${(init.method ?? 'GET').toUpperCase()} ${url.pathname.replace('/api/v1/public', '')}`;
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ key, url, body, headers: new Headers(init.headers) });
    const handler = all[key] ?? Object.entries(all).find(([pattern]) => matches(pattern, key))?.[1];
    if (!handler) return new Response(JSON.stringify({ success: false, error: `no mock for ${key}` }), { status: 500 });
    const result = await handler(body as never, url);
    return new Response(JSON.stringify(result.body), { status: result.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  });
  return { calls };
}
