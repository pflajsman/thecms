export interface AuthConfig {
  tenantName: string;
  clientId: string;
  policyName: string;
  issuer: string;
  audience: string;
}

export function getAuthConfig(): AuthConfig {
  const tenantName = process.env.AZURE_AD_B2C_TENANT_NAME;
  const clientId = process.env.AZURE_AD_B2C_CLIENT_ID;
  const policyName = process.env.AZURE_AD_B2C_POLICY_NAME || 'B2C_1_signupsignin';

  if (!tenantName || !clientId) {
    throw new Error('Azure AD B2C configuration is incomplete. Please check environment variables.');
  }

  const issuer = process.env.AZURE_AD_B2C_ISSUER ||
    `https://${tenantName}.b2clogin.com/${tenantName}.onmicrosoft.com/v2.0/`;

  return {
    tenantName,
    clientId,
    policyName,
    issuer,
    audience: clientId // Audience is typically the client ID
  };
}

// Well-known OpenID configuration endpoint
export function getOpenIdConfigUrl(): string {
  const config = getAuthConfig();
  return `https://${config.tenantName}.b2clogin.com/${config.tenantName}.onmicrosoft.com/${config.policyName}/v2.0/.well-known/openid-configuration`;
}
