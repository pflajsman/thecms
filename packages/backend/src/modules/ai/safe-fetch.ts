import dns from 'dns';
import { Agent, fetch as undiciFetch } from 'undici';
import { isPrivateAddress } from './url-rule';

type LookupCallback = (err: NodeJS.ErrnoException | null, address?: string | dns.LookupAddress[], family?: number) => void;
type DnsLookup = (hostname: string, options: dns.LookupAllOptions, callback: (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void) => void;

const privateAllowed = (env: NodeJS.ProcessEnv) => env.NODE_ENV !== 'production' || env.AI_ALLOW_PRIVATE_URLS === 'true';

/**
 * A DNS lookup for outgoing AI requests that refuses private answers in production. It runs on every connection,
 * so a name that was public when the URL was checked cannot later be pointed at this machine (DNS rebinding).
 */
export function guardedLookup(env: NodeJS.ProcessEnv = process.env, lookup: DnsLookup = dns.lookup as unknown as DnsLookup) {
  return (hostname: string, options: { all?: boolean; family?: number }, callback: LookupCallback): void => {
    lookup(hostname, { ...options, all: true } as dns.LookupAllOptions, (err, addresses) => {
      if (err) return callback(err);
      if (!privateAllowed(env) && addresses.some((a) => isPrivateAddress(a.address))) {
        return callback(Object.assign(new Error('Refused: the AI service address is on a private network'), { code: 'EAI_PRIVATE' }));
      }
      if (options.all) return callback(null, addresses);
      return callback(null, addresses[0]?.address, addresses[0]?.family);
    });
  };
}

const agent = new Agent({ connect: { lookup: guardedLookup() as never } });

/** fetch for user-configured AI services: guarded DNS on every connection. */
export const safeFetch = ((input: string, init?: RequestInit) => undiciFetch(input, { ...(init as object), dispatcher: agent } as never)) as unknown as typeof fetch;
