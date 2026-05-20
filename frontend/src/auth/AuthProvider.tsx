import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  confirmSignUp,
  fetchAuthSession,
  getCurrentUser,
  resendSignUpCode,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  signUp as amplifySignUp,
} from "aws-amplify/auth";
import { api, ApiError } from "@/api/client";
import type { AuthUser as MeUser } from "@/api/types";
import { configureAmplify } from "@/lib/amplify";

type AuthCtx = {
  initialized: boolean;
  authenticated: boolean;
  me: MeUser | null;
  loadingMe: boolean;
  refreshMe: () => Promise<void>;
  /** Last failure loading /api/me (HTTP or network); null if ok */
  apiProfileError: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUpBasic: (
    username: string,
    password: string,
    attrs?: Partial<Record<string, string>>,
  ) => Promise<{ needsConfirmation: boolean }>;
  confirm: (username: string, code: string) => Promise<void>;
  resendConfirmationCode: (username: string) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

function baseUrlHint(): string {
  const b = import.meta.env.VITE_API_BASE_URL ?? "";
  return b.replace(/\/$/, "").trim() || "(VITE_API_BASE_URL is empty)";
}

function httpHint(status: number): string {
  if (status === 401)
    return "Unauthorized — backend usually has wrong COGNITO_USER_POOL_ID or COGNITO_CLIENT_ID vs this frontend .env. ";
  if (status === 404) return "Not found — wrong VITE_API_BASE_URL base (missing / api path). ";
  if (status >= 500) return "Server error — check Express logs on EC2 or locally. ";
  return "";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initialized, setInitialized] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [me, setMe] = useState<MeUser | null>(null);
  const [loadingMe, setLoadingMe] = useState(false);
  const [apiProfileError, setApiProfileError] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    if (!authenticated) {
      setMe(null);
      setApiProfileError(null);
      return;
    }
    setLoadingMe(true);
    setApiProfileError(null);
    try {
      const res = await api.getMe();
      setMe(res.user);
      setApiProfileError(null);
    } catch (e) {
      setMe(null);
      let msg = "Request failed.";
      if (e instanceof ApiError) {
        msg =
          `${httpHint(e.status)}[${e.status}] ${e.message}${e.code ? ` (${e.code})` : ""}`;
      } else if (e instanceof Error) {
        const m = e.message;
        msg =
          m === "Failed to fetch" || m.includes("NetworkError") || m.includes("Load failed")
            ? `Cannot reach backend at ${baseUrlHint()} — ${m}. Is Node listening on PORT?`
            : m;
      }
      setApiProfileError(msg);
    } finally {
      setLoadingMe(false);
    }
  }, [authenticated]);

  useEffect(() => {
    configureAmplify();
    void (async () => {
      try {
        await getCurrentUser();
        const session = await fetchAuthSession();
        if (!session.tokens?.idToken) {
          setAuthenticated(false);
        } else {
          setAuthenticated(true);
        }
      } catch {
        setAuthenticated(false);
      } finally {
        setInitialized(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!initialized || !authenticated) return;
    void refreshMe();
  }, [authenticated, initialized, refreshMe]);

  const signIn = useCallback(async (username: string, password: string) => {
    const res = await amplifySignIn({ username, password });
    if (
      ("isSignedIn" in res && res.isSignedIn) ||
      res.nextStep?.signInStep === "DONE"
    ) {
      await fetchAuthSession({ forceRefresh: true });
      setAuthenticated(true);
      return;
    }
    throw new Error(
      `Additional sign-in step required (${res.nextStep?.signInStep ?? "unknown"}). Configure the user pool for password-only flows or extend the UI.`,
    );
  }, []);

  const signOutFn = useCallback(async () => {
    try {
      await amplifySignOut();
    } finally {
      setAuthenticated(false);
      setMe(null);
      setApiProfileError(null);
    }
  }, []);

  const signUpBasic = useCallback(
    async (username: string, password: string, attrs?: Partial<Record<string, string>>) => {
      const ua: Record<string, string> = {};
      if (attrs) {
        for (const [k, raw] of Object.entries(attrs)) {
          if (typeof raw === "string" && raw.trim()) ua[k] = raw.trim();
        }
      }
      if (!ua.email) ua.email = username.trim();
      const res = await amplifySignUp({
        username: username.trim(),
        password,
        options: { userAttributes: ua },
      });
      const needsConfirmation = res.nextStep.signUpStep === "CONFIRM_SIGN_UP";
      return { needsConfirmation };
    },
    [],
  );

  const confirmFn = useCallback(async (username: string, code: string) => {
    await confirmSignUp({ username, confirmationCode: code });
  }, []);

  const resendConfirmationCode = useCallback(async (username: string) => {
    await resendSignUpCode({ username: username.trim() });
  }, []);

  const value = useMemo<AuthCtx>(
    () => ({
      initialized,
      authenticated,
      me,
      loadingMe,
      refreshMe,
      apiProfileError,
      signIn,
      signOut: signOutFn,
      signUpBasic,
      confirm: confirmFn,
      resendConfirmationCode,
    }),
    [
      apiProfileError,
      authenticated,
      confirmFn,
      initialized,
      loadingMe,
      me,
      refreshMe,
      resendConfirmationCode,
      signIn,
      signOutFn,
      signUpBasic,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be inside AuthProvider");
  return v;
}
