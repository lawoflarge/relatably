import { signInWithApple, signOut, getIdToken } from "./auth";
import * as fbAuth from "firebase/auth";
import { auth } from "./firebase";

jest.mock("expo-apple-authentication", () => ({
  AppleAuthenticationScope: { FULL_NAME: "name", EMAIL: "email" },
  signInAsync: jest.fn(),
  isAvailableAsync: jest.fn(),
}));

jest.mock("./firebase", () => ({
  auth: jest.fn(() => ({ currentUser: { getIdToken: jest.fn() } })),
  firestore: jest.fn(),
}));

jest.mock("firebase/auth", () => {
  const credential = jest.fn((opts: { idToken: string; rawNonce: string }) => ({
    ...opts,
    providerId: "apple.com",
  }));
  return {
    OAuthProvider: jest.fn().mockImplementation((id: string) => ({
      providerId: id,
      credential,
    })),
    signInWithCredential: jest.fn(),
    signOut: jest.fn(),
    __credentialFn: credential,
  };
});

import * as AppleAuthentication from "expo-apple-authentication";

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
    (fbAuth.signInWithCredential as jest.Mock).mockResolvedValueOnce({
      user: { uid: "firebase-uid-1" },
    });

    const out = await signInWithApple();
    expect(AppleAuthentication.signInAsync).toHaveBeenCalled();
    const credentialFn = (fbAuth as unknown as { __credentialFn: jest.Mock }).__credentialFn;
    expect(credentialFn).toHaveBeenCalledWith({
      idToken: "apple-id-token-xyz",
      rawNonce: "the-nonce",
    });
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
    const mockGetIdToken = jest.fn().mockResolvedValueOnce("firebase-id-token-abc");
    (auth as jest.Mock).mockReturnValueOnce({ currentUser: { getIdToken: mockGetIdToken } });
    await expect(getIdToken()).resolves.toBe("firebase-id-token-abc");
  });

  it("signOut calls Firebase auth signOut", async () => {
    (fbAuth.signOut as jest.Mock).mockResolvedValueOnce(undefined);
    await signOut();
    expect(fbAuth.signOut).toHaveBeenCalled();
  });
});
