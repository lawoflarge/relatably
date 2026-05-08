import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";

// In dev with the Firebase Emulator Suite, point the client at the local emulators.
// EXPO_PUBLIC_USE_FIREBASE_EMULATOR=1 should be set in .env.local during dev.
if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === "1") {
  // Default emulator host on simulator: 'localhost' for iOS sim works because
  // sim shares the host network. For physical devices on LAN, replace with the
  // dev machine's LAN IP (e.g. '192.168.1.42').
  firestore().useEmulator("localhost", 8080);
  auth().useEmulator("http://localhost:9099");
}

export { firestore, auth };
