import { signInWithApple, signOut, getIdToken } from "./auth";

jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: { FULL_NAME: "name", EMAIL: "email" },
  signInAsync: jest.fn(),
  isAvailableAsync: jest.fn(),
}));

jest.mock("@react-native-firebase/auth", () => {
  const signInWithCredential = jest.fn();
  const signOutFn = jest.fn();
  const getIdTokenFn = jest.fn();
  const auth: any = jest.fn(() => ({
    signInWithCredential,
    signOut: signOutFn,
    currentUser: { getIdToken: getIdTokenFn },
  }));
  auth.AppleAuthProvider = {
    credential: jest.fn((idToken: string, nonce: string) => ({ idToken, nonce, providerId: "apple.com" })),
  };
  return { __esModule: true, default: auth };
});

import * as AppleAuthentication from "expo-apple-authentication";
import auth from "@react-native-firebase/auth";

describe("ios auth helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("signInWithApple builds a Firebase credential from the Apple ID token", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: "apple-id-token-xyz",
      nonce: "the-nonce",
      user: "apple-user-id",
    });
    (auth() as any).signInWithCredential.mockResolvedValueOnce({ user: { uid: "firebase-uid-1" } });

    const out = await signInWithApple();
    expect(AppleAuthentication.signInAsync).toHaveBeenCalled();
    expect((auth as any).AppleAuthProvider.credential).toHaveBeenCalledWith("apple-id-token-xyz", "the-nonce");
    expect(out).toMatchObject({ uid: "firebase-uid-1" });
  });

  it("signInWithApple throws when identityToken is missing", async () => {
    (AppleAuthentication.signInAsync as jest.Mock).mockResolvedValueOnce({
      identityToken: null,
      nonce: "n",
    });
    await expect(signInWithApple()).rejects.toThrow();
  });

  it("getIdToken returns the current Firebase ID token", async () => {
    (auth() as any).currentUser.getIdToken.mockResolvedValueOnce("firebase-id-token-abc");
    await expect(getIdToken()).resolves.toBe("firebase-id-token-abc");
  });

  it("signOut calls Firebase auth signOut", async () => {
    (auth() as any).signOut.mockResolvedValueOnce(undefined);
    await signOut();
    expect((auth() as any).signOut).toHaveBeenCalled();
  });
});
