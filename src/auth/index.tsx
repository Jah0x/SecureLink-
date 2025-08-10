import { createContext, useContext, useEffect, useState } from 'react';

interface GoogleUserData {
  name?: string;
  given_name?: string;
}

interface User {
  email: string;
  google_user_data?: GoogleUserData;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  isPending: boolean;
  isFetching: boolean;
  redirectToLogin: () => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  exchangeCodeForSessionToken: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isPending: true,
  isFetching: false,
  redirectToLogin: async () => {},
  loginWithPassword: async () => {},
  register: async () => {},
  exchangeCodeForSessionToken: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const API_BASE_URL = import.meta.env.NEXT_PUBLIC_API_BASE_URL || '';
  const [user, setUser] = useState<User | null>(null);
  const [isPending, setPending] = useState(true);
  const [isFetching, setFetching] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/users/me`);
        if (res.ok) {
          const data: User = await res.json();
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
      const res = await fetch(`${API_BASE_URL}/api/oauth/google/redirect_url`);
      const data = await res.json();
      window.location.href = data.redirectUrl;
    } finally {
      setFetching(false);
    }
  };

  const loginWithPassword = async (email: string, password: string) => {
    setFetching(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/password/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.ok) {
        const me = await fetch(`${API_BASE_URL}/api/users/me`);
        if (me.ok) {
          setUser((await me.json()) as User);
        }
      }
    } finally {
      setFetching(false);
    }
  };

  const register = async (email: string, password: string) => {
    setFetching(true);
    try {
      await fetch(`${API_BASE_URL}/api/password/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } finally {
      setFetching(false);
    }
  };

  const exchangeCodeForSessionToken = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) throw new Error('Code not provided');
    await fetch(`${API_BASE_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const res = await fetch(`${API_BASE_URL}/api/users/me`);
    if (res.ok) {
      setUser((await res.json()) as User);
    }
  };

  const logout = async () => {
    await fetch(`${API_BASE_URL}/api/logout`);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, isPending, isFetching, redirectToLogin, loginWithPassword, register, exchangeCodeForSessionToken, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
