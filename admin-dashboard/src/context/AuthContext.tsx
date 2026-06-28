// admin-dashboard/src/context/AuthContext.tsx

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  fetchAdminUser,
  loginAdmin,
  type AdminUser,
} from "../services/api";

const ADMIN_TOKEN_KEY =
  "bottle_ordering_admin_token";

type AuthContextValue = {
  user: AdminUser | null;
  token: string | null;
  loading: boolean;
  authenticating: boolean;
  error: string | null;
  isAuthenticated: boolean;

  login: (
    identifier: string,
    password: string
  ) => Promise<boolean>;

  logout: () => void;
  clearError: () => void;
};

const AuthContext = createContext<
  AuthContextValue | undefined
>(undefined);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [user, setUser] =
    useState<AdminUser | null>(null);

  const [token, setToken] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [
    authenticating,
    setAuthenticating,
  ] = useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const clearSession = useCallback(() => {
    localStorage.removeItem(
      ADMIN_TOKEN_KEY
    );

    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    async function restoreSession() {
      const savedToken =
        localStorage.getItem(
          ADMIN_TOKEN_KEY
        );

      if (!savedToken) {
        setLoading(false);
        return;
      }

      try {
        const adminUser =
          await fetchAdminUser(
            savedToken
          );

        setToken(savedToken);
        setUser(adminUser);
      } catch {
        clearSession();
      } finally {
        setLoading(false);
      }
    }

    void restoreSession();
  }, [clearSession]);

  const login = useCallback(
    async (
      identifier: string,
      password: string
    ): Promise<boolean> => {
      setAuthenticating(true);
      setError(null);

      try {
        const session =
          await loginAdmin(
            identifier,
            password
          );

        localStorage.setItem(
          ADMIN_TOKEN_KEY,
          session.token
        );

        setToken(session.token);
        setUser(session.user);

        return true;
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to log in."
        );

        return false;
      } finally {
        setAuthenticating(false);
      }
    },
    []
  );

  const logout = useCallback(() => {
    clearSession();
  }, [clearSession]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value =
    useMemo<AuthContextValue>(
      () => ({
        user,
        token,
        loading,
        authenticating,
        error,

        isAuthenticated: Boolean(
          user && token
        ),

        login,
        logout,
        clearError,
      }),
      [
        user,
        token,
        loading,
        authenticating,
        error,
        login,
        logout,
        clearError,
      ]
    );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAdminAuth(): AuthContextValue {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAdminAuth must be used inside AuthProvider"
    );
  }

  return context;
}