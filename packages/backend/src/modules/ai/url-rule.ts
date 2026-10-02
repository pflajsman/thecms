import { promises as dns } from 'dns';
import net from 'net';
import { AppError } from '../../middleware/error.middleware';

const PRIVATE = 'Addresses on this machine or a private network are not allowed on this server';

const bad = (message: string) => new AppError(message, 400, { reason: 'BASE_URL' });

// Addresses a base URL must not reach in production, written as the URL parser normalises them.
// One list per family: a single BlockList also matches IPv4 addresses against the IPv6 rules.
const blockedV4 = new net.BlockList();
const blockedV6 = new net.BlockList();
for (const [network, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blockedV4.addSubnet(network, prefix, 'ipv4');
for (const [network, prefix] of [
  ['::', 96], // unspecified, loopback and IPv4-compatible (::a.b.c.d)
  ['::ffff:0:0', 96], // IPv4-mapped
  ['64:ff9b::', 96], // NAT64
  ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) blockedV6.addSubnet(network, prefix, 'ipv6');

/** Loopback, private, link-local, carrier-grade NAT, multicast, reserved, and their IPv6 mapped forms. */
export function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) return blockedV4.check(ip, 'ipv4');
  if (net.isIPv6(ip)) return blockedV6.check(ip, 'ipv6');
  return true;
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
