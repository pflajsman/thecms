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
