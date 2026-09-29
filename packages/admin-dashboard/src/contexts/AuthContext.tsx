import { createContext, useContext, useState, useMemo, useCallback, type ReactNode } from 'react';
import { useMsal, useIsAuthenticated } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { loginRequest, isEntraConfigured } from '../config/msalConfig';

interface User {
  sub: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: () => void;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default token for development (same as backend test token)
const DEFAULT_TOKEN = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsIm5hbWUiOiJUZXN0IEFkbWluIn0=.signature';

function storeToken(token: string | null) {
  // The API client reads the dev token from storage; write it before any child query runs.
  try {
    if (token) localStorage.setItem('auth_token', token);
    else localStorage.removeItem('auth_token');
  } catch {
    // Storage unavailable: requests go without a token.
  }
}

function devSession(): { token: string; user: User } {
  const decoded = JSON.parse(atob(DEFAULT_TOKEN.split('.')[1]));
  storeToken(DEFAULT_TOKEN);
  return { token: DEFAULT_TOKEN, user: { sub: decoded.sub, email: decoded.email, name: decoded.name } };
}

function DevAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<{ token: string; user: User } | null>(devSession);
  const token = session?.token ?? null;
  const user = session?.user ?? null;

  const login = () => setSession(devSession());

  const logout = () => {
    storeToken(null);
    setSession(null);
  };

  const getAccessToken = async () => token;

  return (
    <AuthContext.Provider
      value={{ user, token, login, logout, isAuthenticated: !!token, isLoading: false, getAccessToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

function EntraAuthProvider({ children }: { children: ReactNode }) {
  const { instance, accounts, inProgress } = useMsal();
  const isAuthenticated = useIsAuthenticated();
  const [token, setToken] = useState<string | null>(null);

  const isLoading = inProgress !== InteractionStatus.None;

  const user = useMemo<User | null>(
    () =>
      isAuthenticated && accounts.length > 0
        ? { sub: accounts[0].localAccountId, email: accounts[0].username || '', name: accounts[0].name || '' }
        : null,
    [isAuthenticated, accounts],
  );

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!isAuthenticated || accounts.length === 0) return null;

    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      setToken(response.accessToken);
      return response.accessToken;
    } catch {
      // Silent token acquisition failed, try interactive
      try {
        const response = await instance.acquireTokenPopup(loginRequest);
        setToken(response.accessToken);
        return response.accessToken;
      } catch {
        return null;
      }
    }
  }, [instance, accounts, isAuthenticated]);

  const login = useCallback(() => {
    instance.loginRedirect(loginRequest);
  }, [instance]);

  const logout = useCallback(() => {
    instance.logoutRedirect({ postLogoutRedirectUri: window.location.origin });
  }, [instance]);

  return (
    <AuthContext.Provider
      value={{ user, token: isAuthenticated ? token : null, login, logout, isAuthenticated, isLoading, getAccessToken }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function AuthProvider({ children }: { children: ReactNode }) {
  if (isEntraConfigured()) {
    return <EntraAuthProvider>{children}</EntraAuthProvider>;
  }
  return <DevAuthProvider>{children}</DevAuthProvider>;
}

// Provider and hook live together so every consumer imports one module.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
