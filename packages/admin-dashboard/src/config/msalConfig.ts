import { Configuration, LogLevel } from '@azure/msal-browser';

const tenantName = import.meta.env.VITE_AZURE_ENTRA_TENANT_NAME || '';
const clientId = import.meta.env.VITE_AZURE_ENTRA_CLIENT_ID || '';
const tenantId = import.meta.env.VITE_AZURE_ENTRA_TENANT_ID || '';

export const msalConfig: Configuration = {
  auth: {
    clientId,
    authority: `https://${tenantName}.ciamlogin.com/${tenantId}`,
    redirectUri: window.location.origin,
    postLogoutRedirectUri: window.location.origin,
    knownAuthorities: [`${tenantName}.ciamlogin.com`],
  },
  cache: {
    cacheLocation: 'localStorage',
    storeAuthStateInCookie: false,
  },
  system: {
    loggerOptions: {
      logLevel: LogLevel.Warning,
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            break;
          case LogLevel.Warning:
            console.warn(message);
            break;
        }
      },
    },
  },
};

// Scopes for the backend API
const apiClientId = import.meta.env.VITE_AZURE_ENTRA_API_CLIENT_ID || clientId;

export const loginRequest = {
  scopes: [`api://${apiClientId}/cms.read`, `api://${apiClientId}/cms.write`],
};

export const apiScopes = {
  read: `api://${apiClientId}/cms.read`,
  write: `api://${apiClientId}/cms.write`,
};

export function isEntraConfigured(): boolean {
  return !!(tenantName && clientId && tenantId);
}
