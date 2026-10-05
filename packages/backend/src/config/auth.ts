export interface AuthConfig {
  tenantId: string;
  clientId: string;
  authority: string;
  issuer: string;
  audience: string;
  jwksUri: string;
}

const isDev = process.env.NODE_ENV !== 'production';

export function getAuthConfig(): AuthConfig {
  const tenantId = process.env.AZURE_ENTRA_TENANT_ID || '';
  const clientId = process.env.AZURE_ENTRA_CLIENT_ID || '';

  if (!isDev && (!tenantId || !clientId)) {
    throw new Error(
      'Microsoft Entra External ID configuration is incomplete. ' +
      'Set AZURE_ENTRA_TENANT_ID and AZURE_ENTRA_CLIENT_ID.'
    );
  }

  const authority = `https://${tenantId}.ciamlogin.com/${tenantId}/v2.0`;
  const issuer = `https://${tenantId}.ciamlogin.com/${tenantId}/v2.0`;
  const jwksUri = `https://${tenantId}.ciamlogin.com/${tenantId}/discovery/v2.0/keys`;

  return {
    tenantId,
    clientId,
    authority,
    issuer,
    audience: clientId,
    jwksUri,
  };
}

export function getOpenIdConfigUrl(): string {
  const config = getAuthConfig();
  return `https://${config.tenantId}.ciamlogin.com/${config.tenantId}/v2.0/.well-known/openid-configuration`;
}

export function isDevMode(): boolean {
  return isDev;
}

/**
 * Superadmins from SUPERADMINS (comma separated). Each entry is an Entra subject id or an email address.
 * Prefer subject ids in production: they cannot be claimed by another account.
 */
export function isSuperadminIdentity(identity: { sub: string; email?: string }): boolean {
  const entries = (process.env.SUPERADMINS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return entries.includes(identity.sub.toLowerCase()) || (!!identity.email && entries.includes(identity.email.toLowerCase()));
}

/** Where the admin dashboard runs, for links in emails. */
export function adminUrl(): string {
  return (process.env.ADMIN_URL || 'http://localhost:5173').replace(/\/$/, '');
}
