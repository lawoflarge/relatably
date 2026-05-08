import * as AppleAuthentication from "expo-apple-authentication";
import auth from "@react-native-firebase/auth";

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

  const firebaseCredential = (auth as any).AppleAuthProvider.credential(
    credential.identityToken,
    (credential as any).nonce ?? "",
  );
  const userCredential = await auth().signInWithCredential(firebaseCredential);
  return { uid: userCredential.user.uid };
}

export async function signOut(): Promise<void> {
  await auth().signOut();
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
