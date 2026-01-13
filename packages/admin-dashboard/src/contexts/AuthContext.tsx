import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  sub: string;
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, name: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default token for development (same as backend test token)
const DEFAULT_TOKEN = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzdWIiOiJ0ZXN0LXVzZXItMTIzIiwiZW1haWwiOiJhZG1pbkBleGFtcGxlLmNvbSIsIm5hbWUiOiJUZXN0IEFkbWluIn0=.signature';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    // Check for stored token on mount
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      setToken(storedToken);
      // Decode the token to get user info (simplified - just parse the payload)
      try {
        const payload = storedToken.split('.')[1];
        const decoded = JSON.parse(atob(payload));
        setUser({
          sub: decoded.sub,
          email: decoded.email,
          name: decoded.name,
        });
      } catch (error) {
        console.error('Failed to decode token:', error);
        localStorage.removeItem('auth_token');
      }
    } else {
      // Auto-login with default token for development
      const payload = DEFAULT_TOKEN.split('.')[1];
      const decoded = JSON.parse(atob(payload));
      setToken(DEFAULT_TOKEN);
      setUser({
        sub: decoded.sub,
        email: decoded.email,
        name: decoded.name,
      });
      localStorage.setItem('auth_token', DEFAULT_TOKEN);
    }
  }, []);

  const login = (email: string, name: string) => {
    // For now, just use the default token
    // In production, this would call Azure AD B2C and get a real token
    setToken(DEFAULT_TOKEN);
    setUser({ sub: 'test-user-123', email, name });
    localStorage.setItem('auth_token', DEFAULT_TOKEN);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('auth_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
