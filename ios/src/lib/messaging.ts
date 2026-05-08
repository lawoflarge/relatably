import messaging from "@react-native-firebase/messaging";

const AUTHORIZED = (messaging as any).AuthorizationStatus.AUTHORIZED ?? 1;
const PROVISIONAL = (messaging as any).AuthorizationStatus.PROVISIONAL ?? 2;

export async function requestNotificationPermission(): Promise<boolean> {
  const status = await messaging().requestPermission();
  return status === AUTHORIZED || status === PROVISIONAL;
}

export async function getFcmToken(): Promise<string | null> {
  try {
    const token = await messaging().getToken();
    return token ?? null;
  } catch {
    return null;
  }
}
