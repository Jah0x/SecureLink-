import { createContext, useContext, useEffect, useState } from 'react';

interface User {
  id: number;
  email: string;
  role: string;
  created_at: string;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  isPending: boolean;
  isFetching: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isPending: true,
  isFetching: false,
  login: async () => {},
  register: async () => false,
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

  const login = async (email: string, password: string) => {
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
      await login(email, password);
      return true;
    } finally {
      setFetching(false);
    }
  };

  const logout = async () => {
    await fetch(`${API_BASE_URL}/api/auth/logout`, { method: 'POST', credentials: 'include' });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isPending, isFetching, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
