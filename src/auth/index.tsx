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
  loginWithGoogle: () => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<boolean>;
  exchangeCodeForSessionToken: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isPending: true,
  isFetching: false,
  loginWithGoogle: async () => {},
  loginWithPassword: async () => {},
  register: async () => false,
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
        const res = await fetch(`${API_BASE_URL}/api/users/me`, {
          credentials: 'include',
        });
        if (res.ok) {
          const data: User = await res.json();
          setUser(data);
        }
      } finally {
        setPending(false);
      }
    })();
  }, []);

  const loginWithGoogle = async () => {
    setFetching(true);
    try {
      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get('redirectTo') || params.get('redirect_to') || '';
      const callback = `${API_BASE_URL}/thirdparty/callback${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`;
      const res = await fetch(
        `${API_BASE_URL}/thirdparty/google/redirect_url?redirect_url=${encodeURIComponent(callback)}`,
        { credentials: 'include' }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return;
        }
      }
      alert('Не удалось получить ссылку авторизации');
    } finally {
      setFetching(false);
    }
  };

  const loginWithPassword = async (email: string, password: string) => {
    setFetching(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        alert('Ошибка входа');
        return;
      }
      const me = await fetch(`${API_BASE_URL}/api/users/me`, { credentials: 'include' });
      if (me.ok) {
        setUser((await me.json()) as User);
      }
    } finally {
      setFetching(false);
    }
  };

  const register = async (email: string, password: string) => {
    setFetching(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        alert('Ошибка регистрации');
        return false;
      }
      await loginWithPassword(email, password);
      return true;
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
      credentials: 'include',
      body: JSON.stringify({ code }),
    });
    const res = await fetch(`${API_BASE_URL}/api/users/me`, { credentials: 'include' });
    if (res.ok) {
      setUser((await res.json()) as User);
    }
  };

  const logout = async () => {
    await fetch(`${API_BASE_URL}/api/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, isPending, isFetching, loginWithGoogle, loginWithPassword, register, exchangeCodeForSessionToken, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
