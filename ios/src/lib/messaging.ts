// v1.0 ships without @react-native-firebase/messaging because the RNFB
// Messaging Swift target needs FirebaseAuth-Swift.h that doesn't get
// generated under the current Expo SDK 54 + RNFB v22 build chain.
// Daily push notifications return in v1.0.1.
//
// Caller (app/(tabs)/index.tsx) ignores both return values when permission
// fails / token is null, so the boot flow continues unaffected.

export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function getFcmToken(): Promise<string | null> {
  return null;
}
