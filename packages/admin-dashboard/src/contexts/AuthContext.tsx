import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
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

function DevAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const payload = DEFAULT_TOKEN.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    setToken(DEFAULT_TOKEN);
    setUser({
      sub: decoded.sub,
      email: decoded.email,
      name: decoded.name,
    });
    localStorage.setItem('auth_token', DEFAULT_TOKEN);
  }, []);

  const login = () => {
    const payload = DEFAULT_TOKEN.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    setToken(DEFAULT_TOKEN);
    setUser({ sub: decoded.sub, email: decoded.email, name: decoded.name });
    localStorage.setItem('auth_token', DEFAULT_TOKEN);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
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
  const [user, setUser] = useState<User | null>(null);

  const isLoading = inProgress !== InteractionStatus.None;

  useEffect(() => {
    if (isAuthenticated && accounts.length > 0) {
      const account = accounts[0];
      setUser({
        sub: account.localAccountId,
        email: account.username || '',
        name: account.name || '',
      });
    } else {
      setUser(null);
      setToken(null);
    }
  }, [isAuthenticated, accounts]);

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
      value={{ user, token, login, logout, isAuthenticated, isLoading, getAccessToken }}
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
