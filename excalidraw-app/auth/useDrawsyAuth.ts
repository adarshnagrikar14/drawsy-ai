import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { useCallback, useEffect, useMemo, useState } from "react";

import { getFirebaseApp } from "../data/firebaseApp";

import type { User } from "firebase/auth";

export type DrawsyAuthState = {
  status: "loading" | "anonymous" | "authenticated";
  user: User | null;
  error: string | null;
  isBusy: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string>;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Authentication failed.";

export const useDrawsyAuth = (): DrawsyAuthState => {
  const auth = useMemo(() => getAuth(getFirebaseApp()), []);
  const [status, setStatus] = useState<DrawsyAuthState["status"]>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(
    () =>
      onAuthStateChanged(
        auth,
        (nextUser) => {
          setUser(nextUser);
          setStatus(nextUser ? "authenticated" : "anonymous");
          setError(null);
        },
        (authError) => {
          setUser(null);
          setStatus("anonymous");
          setError(getErrorMessage(authError));
        },
      ),
    [auth],
  );

  const handleSignIn = useCallback(async () => {
    setError(null);
    setIsBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      await signInWithPopup(auth, provider);
    } catch (authError: unknown) {
      setError(getErrorMessage(authError));
      throw authError;
    } finally {
      setIsBusy(false);
    }
  }, [auth]);

  const handleSignOut = useCallback(async () => {
    setError(null);
    setIsBusy(true);
    try {
      await signOut(auth);
    } catch (authError: unknown) {
      setError(getErrorMessage(authError));
      throw authError;
    } finally {
      setIsBusy(false);
    }
  }, [auth]);

  const getIdToken = useCallback(async () => {
    if (!auth.currentUser) {
      throw new Error("Authentication is required.");
    }
    return auth.currentUser.getIdToken();
  }, [auth]);

  return {
    status,
    user,
    error,
    isBusy,
    signIn: handleSignIn,
    signOut: handleSignOut,
    getIdToken,
  };
};
