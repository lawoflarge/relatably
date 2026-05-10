import * as AppleAuthentication from "expo-apple-authentication";
import {
  OAuthProvider,
  signInWithCredential,
  signOut as fbSignOut,
} from "firebase/auth";
import { auth } from "./firebase";

export interface SignedInUser {
  uid: string;
}

export async function signInWithApple(): Promise<SignedInUser> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  if (!credential.identityToken) {
    throw new Error("Apple Sign-in returned no identity token");
  }

  const provider = new OAuthProvider("apple.com");
  const firebaseCredential = provider.credential({
    idToken: credential.identityToken,
    rawNonce: (credential as { nonce?: string }).nonce ?? "",
  });
  const userCredential = await signInWithCredential(auth(), firebaseCredential);
  return { uid: userCredential.user.uid };
}

export async function signOut(): Promise<void> {
  await fbSignOut(auth());
}

export async function getIdToken(): Promise<string | null> {
  const user = auth().currentUser;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch {
    return null;
  }
}
