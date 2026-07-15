import AsyncStorage from "@react-native-async-storage/async-storage";

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
  type AuthUser,
  fetchCurrentUser,
  type LoginInput,
  loginCustomer,
  type RegisterInput,
  registerCustomer,
} from "../services/api";

const AUTH_TOKEN_KEY =
  "@bottle_ordering/auth_token";

type AuthContextValue = {
  user: AuthUser | null;

  token: string | null;

  loading: boolean;

  authenticating: boolean;

  error: string | null;

  isAuthenticated: boolean;

  login: (
    input: LoginInput
  ) => Promise<boolean>;

  register: (
    input: RegisterInput
  ) => Promise<boolean>;

  logout: () => Promise<void>;

  refreshUser: () => Promise<void>;

  updateUser: (
    updatedUser: AuthUser
  ) => void;

  clearError: () => void;
};

const AuthContext =
  createContext<
    AuthContextValue | undefined
  >(undefined);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [
    user,
    setUser,
  ] =
    useState<AuthUser | null>(
      null
    );

  const [
    token,
    setToken,
  ] =
    useState<string | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    authenticating,
    setAuthenticating,
  ] =
    useState(false);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );

  const clearSession =
    useCallback(
      async () => {
        try {
          await AsyncStorage.removeItem(
            AUTH_TOKEN_KEY
          );
        } finally {
          setToken(null);
          setUser(null);
        }
      },
      []
    );

  const restoreSession =
    useCallback(
      async () => {
        setLoading(true);

        try {
          const savedToken =
            await AsyncStorage.getItem(
              AUTH_TOKEN_KEY
            );

          if (!savedToken) {
            return;
          }

          const currentUser =
            await fetchCurrentUser(
              savedToken
            );

          setToken(savedToken);
          setUser(currentUser);
        } catch {
          await clearSession();
        } finally {
          setLoading(false);
        }
      },
      [clearSession]
    );

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const saveSession =
    useCallback(
      async (
        sessionToken: string,
        sessionUser: AuthUser
      ) => {
        await AsyncStorage.setItem(
          AUTH_TOKEN_KEY,
          sessionToken
        );

        setToken(sessionToken);
        setUser(sessionUser);
      },
      []
    );

  const login =
    useCallback(
      async (
        input: LoginInput
      ): Promise<boolean> => {
        setAuthenticating(true);
        setError(null);

        try {
          const session =
            await loginCustomer(input);

          await saveSession(
            session.token,
            session.user
          );

          return true;
        } catch (requestError) {
          const message =
            requestError instanceof Error
              ? requestError.message
              : "Unable to log in.";

          setError(message);

          return false;
        } finally {
          setAuthenticating(false);
        }
      },
      [saveSession]
    );

  const register =
    useCallback(
      async (
        input: RegisterInput
      ): Promise<boolean> => {
        setAuthenticating(true);
        setError(null);

        try {
          const session =
            await registerCustomer(
              input
            );

          await saveSession(
            session.token,
            session.user
          );

          return true;
        } catch (requestError) {
          const message =
            requestError instanceof Error
              ? requestError.message
              : "Unable to create your account.";

          setError(message);

          return false;
        } finally {
          setAuthenticating(false);
        }
      },
      [saveSession]
    );

  const logout =
    useCallback(
      async () => {
        setError(null);
        await clearSession();
      },
      [clearSession]
    );

  const refreshUser =
    useCallback(
      async () => {
        if (!token) {
          return;
        }

        try {
          const currentUser =
            await fetchCurrentUser(
              token
            );

          setUser(currentUser);
        } catch {
          await clearSession();
        }
      },
      [
        token,
        clearSession,
      ]
    );

  const updateUser =
    useCallback(
      (updatedUser: AuthUser) => {
        setUser(updatedUser);
      },
      []
    );

  const clearError =
    useCallback(
      () => {
        setError(null);
      },
      []
    );

  const value =
    useMemo<AuthContextValue>(
      () => ({
        user,
        token,
        loading,
        authenticating,
        error,

        isAuthenticated:
          Boolean(
            user &&
            token
          ),

        login,
        register,
        logout,
        refreshUser,
        updateUser,
        clearError,
      }),
      [
        user,
        token,
        loading,
        authenticating,
        error,
        login,
        register,
        logout,
        refreshUser,
        updateUser,
        clearError,
      ]
    );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used inside AuthProvider."
    );
  }

  return context;
}