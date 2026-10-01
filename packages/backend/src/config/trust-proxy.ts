import type { Application } from 'express';

/**
 * Proxy hops to trust for req.ip. Azure App Service puts one front end before the app,
 * so production trusts one hop unless TRUST_PROXY says otherwise.
 */
export function trustProxySetting(env: NodeJS.ProcessEnv): number | false {
  const raw = env.TRUST_PROXY;
  if (raw !== undefined) {
    const hops = Number(raw);
    return Number.isInteger(hops) && hops > 0 ? hops : false;
  }
  return env.NODE_ENV === 'production' ? 1 : false;
}

export function configureTrustProxy(app: Application, env: NodeJS.ProcessEnv = process.env): void {
  app.set('trust proxy', trustProxySetting(env));
}
