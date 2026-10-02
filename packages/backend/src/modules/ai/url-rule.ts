import { promises as dns } from 'dns';
import net from 'net';
import { AppError } from '../../middleware/error.middleware';

const PRIVATE = 'Addresses on this machine or a private network are not allowed on this server';

const bad = (message: string) => new AppError(message, 400, { reason: 'BASE_URL' });

/** Loopback, private, link-local, carrier-grade NAT and unique-local addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith('::ffff:')) return isPrivateAddress(v6.slice(7));
  return v6 === '::' || v6 === '::1' || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
}

type Lookup = (host: string) => Promise<{ address: string; family: number }[]>;
const systemLookup: Lookup = (host) => dns.lookup(host, { all: true });

/**
 * Checks the base URL of an OpenAI-compatible service and returns it without a trailing slash.
 * In production the backend must not be pointed at itself or the private network, unless AI_ALLOW_PRIVATE_URLS=true.
 */
export async function checkBaseUrl(raw: string, env: NodeJS.ProcessEnv = process.env, lookup: Lookup = systemLookup): Promise<string> {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw bad('Enter a valid http or https address');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw bad('Use an http or https address');
  const normalised = url.toString().replace(/\/+$/, '');
  if (env.NODE_ENV !== 'production' || env.AI_ALLOW_PRIVATE_URLS === 'true') return normalised;

  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost')) throw bad(PRIVATE);
  let addresses: { address: string }[];
  if (net.isIP(host)) addresses = [{ address: host }];
  else {
    try {
      addresses = await lookup(host);
    } catch {
      throw bad('This address cannot be found');
    }
  }
  if (addresses.some((a) => isPrivateAddress(a.address))) throw bad(PRIVATE);
  return normalised;
}
