import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api, ApiError } from "../lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string;
  teams?: Array<{
    teamId: string;
    teamName: string;
    teamSlug: string;
    role: string;
  }>;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => void;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const token = localStorage.getItem("pf_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const data = await api.me();
      setUser(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem("pf_token");
        setUser(null);
      } else {
        setError("Failed to load user");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check for token in URL (from OAuth callback)
    const params = new URLSearchParams(window.location.search);
    const tokenFromUrl = params.get("token");

    if (tokenFromUrl) {
      localStorage.setItem("pf_token", tokenFromUrl);
      // Clean up URL
      window.history.replaceState({}, "", "/");
    }

    refresh();
  }, [refresh]);

  const login = useCallback(() => {
    window.location.href = "/auth/github";
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } catch {
      // Ignore errors on logout
    }
    localStorage.removeItem("pf_token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, error, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
