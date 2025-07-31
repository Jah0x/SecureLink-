import { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  user: Record<string, unknown> | null;
  isPending: boolean;
  isFetching: boolean;
  redirectToLogin: () => Promise<void>;
  exchangeCodeForSessionToken: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isPending: true,
  isFetching: false,
  redirectToLogin: async () => {},
  exchangeCodeForSessionToken: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [isPending, setPending] = useState(true);
  const [isFetching, setFetching] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/users/me');
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } finally {
        setPending(false);
      }
    })();
  }, []);

  const redirectToLogin = async () => {
    setFetching(true);
    try {
      const res = await fetch('/api/oauth/google/redirect_url');
      const data = await res.json();
      window.location.href = data.redirectUrl;
    } finally {
      setFetching(false);
    }
  };

  const exchangeCodeForSessionToken = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) throw new Error('Code not provided');
    await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const res = await fetch('/api/users/me');
    if (res.ok) {
      setUser(await res.json());
    }
  };

  const logout = async () => {
    await fetch('/api/logout');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, isPending, isFetching, redirectToLogin, exchangeCodeForSessionToken, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
