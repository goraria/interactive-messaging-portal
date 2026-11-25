"use client";
import { type PropsWithChildren, useCallback, useMemo, useState } from "react";
import { useProgress } from "@/hooks/use-progress";
import { AuthContext } from "@/hooks/use-auth";
import type { AuthContextValue } from "@/utils/interface";
import {
  login as requestLogin,
  register as requestRegister,
  useAuthAccount,
  useAuthLogoutMutation,
} from "@/queries/auth";

const signInError = "Sign in is unavailable. Please try again.";

export function AuthProvider({ children }: PropsWithChildren) {
  const { account, loading: accountLoading, error, refresh } = useAuthAccount();
  const [logoutMutation, logoutState] = useAuthLogoutMutation();
  const [actionError, setActionError] = useState<Error | null>(null);
  const { pending: signingIn, run } = useProgress();

  const beginSignIn = useCallback(
    async (returnTo: string, registration = false) => {
      setActionError(null);
      await run(
        () =>
          registration ? requestRegister(returnTo) : requestLogin(returnTo),
        {
          keepUntilNavigation: true,
          errorMessage: signInError,
          errorTitle: "Unable to sign in",
          errorId: "chat-sign-in-error",
          onError: () => setActionError(new Error(signInError)),
        },
      );
    },
    [run],
  );
  const login = useCallback(
    (returnTo = "/chat") => beginSignIn(returnTo),
    [beginSignIn],
  );
  const register = useCallback(
    (returnTo = "/chat") => beginSignIn(returnTo, true),
    [beginSignIn],
  );
  const logout = useCallback(
    async (returnTo = "/") => {
      await logoutMutation(returnTo).unwrap();
    },
    [logoutMutation],
  );
  const value = useMemo<AuthContextValue>(
    () => ({
      account,
      loading: accountLoading || logoutState.isLoading,
      signingIn,
      error: actionError ?? error ?? null,
      authenticated: Boolean(account),
      refresh,
      login,
      register,
      logout,
    }),
    [
      account,
      accountLoading,
      signingIn,
      actionError,
      error,
      login,
      logout,
      logoutState.isLoading,
      refresh,
      register,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function Auth({ children }: PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>;
}
