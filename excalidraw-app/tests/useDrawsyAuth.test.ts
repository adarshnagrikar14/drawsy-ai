import { act, renderHook, waitFor } from "@testing-library/react";

import { useDrawsyAuth } from "../auth/useDrawsyAuth";

import type { User } from "firebase/auth";

const authMocks = vi.hoisted(() => {
  const auth = { currentUser: null as User | null };
  return {
    auth,
    onAuthStateChanged: vi.fn(
      (_auth: unknown, onUser: (user: User | null) => void) => {
        onUser(auth.currentUser);
        return vi.fn();
      },
    ),
    signInWithPopup: vi.fn(() => Promise.resolve()),
    signOut: vi.fn(() => Promise.resolve()),
    setCustomParameters: vi.fn(),
  };
});

vi.mock("../data/firebaseApp", () => ({
  getFirebaseApp: () => ({}),
}));

vi.mock("firebase/auth", () => ({
  getAuth: () => authMocks.auth,
  onAuthStateChanged: authMocks.onAuthStateChanged,
  signInWithPopup: authMocks.signInWithPopup,
  signOut: authMocks.signOut,
  GoogleAuthProvider: class {
    setCustomParameters = authMocks.setCustomParameters;
  },
}));

describe("useDrawsyAuth", () => {
  beforeEach(() => {
    authMocks.auth.currentUser = null;
    vi.clearAllMocks();
  });

  it("initializes as anonymous and starts Google OAuth on demand", async () => {
    const { result } = renderHook(() => useDrawsyAuth());

    await waitFor(() => expect(result.current.status).toBe("anonymous"));
    await act(() => result.current.signIn());

    expect(authMocks.setCustomParameters).toHaveBeenCalledWith({
      prompt: "select_account",
    });
    expect(authMocks.signInWithPopup).toHaveBeenCalledTimes(1);
  });

  it("returns the current Firebase ID token and signs out", async () => {
    const getIdToken = vi.fn(() => Promise.resolve("id-token"));
    authMocks.auth.currentUser = { getIdToken } as unknown as User;
    const { result } = renderHook(() => useDrawsyAuth());

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    await expect(result.current.getIdToken()).resolves.toBe("id-token");
    await act(() => result.current.signOut());

    expect(getIdToken).toHaveBeenCalledTimes(1);
    expect(authMocks.signOut).toHaveBeenCalledTimes(1);
  });
});
