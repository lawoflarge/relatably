import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import {
  getFirestore,
  connectFirestoreEmulator,
  type Firestore,
} from "firebase/firestore";
import {
  initializeAuth,
  getAuth,
  connectAuthEmulator,
  // @ts-expect-error -- typing exists at runtime via dist subpath
  getReactNativePersistence,
  type Auth,
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Public-by-design Firebase Web SDK config (every Firebase JS app exposes
// these in its bundle; security comes from Firestore Security Rules).
const firebaseConfig = {
  apiKey: "AIzaSyDvBvtlIzCK_9TvNAmPv5l2YyV4jYsu1Fg",
  authDomain: "relatably-prod.firebaseapp.com",
  projectId: "relatably-prod",
  storageBucket: "relatably-prod.firebasestorage.app",
  messagingSenderId: "460980856315",
  appId: "1:460980856315:web:db886b968a140c7dd2975e",
};

// Lazy singletons. Initialised on first use, NOT at module import.
// Doing the init at module-load time was crashing the iOS bundle when
// any error in initializeApp/initializeAuth bubbled to Hermes before
// our error boundary could catch it.
let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _firestore: Firestore | null = null;

function getApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]!;
  return _app;
}

function getAuthInstance(): Auth {
  if (_auth) return _auth;
  const app = getApp();
  try {
    _auth = initializeAuth(app, {
      persistence: getReactNativePersistence
        ? getReactNativePersistence(AsyncStorage)
        : undefined,
    });
  } catch {
    _auth = getAuth(app);
  }
  if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === "1") {
    try { connectAuthEmulator(_auth, "http://localhost:9099"); } catch { /* hot reload */ }
  }
  return _auth;
}

function getFirestoreInstance(): Firestore {
  if (_firestore) return _firestore;
  _firestore = getFirestore(getApp());
  if (process.env.EXPO_PUBLIC_USE_FIREBASE_EMULATOR === "1") {
    try { connectFirestoreEmulator(_firestore, "localhost", 8080); } catch { /* hot reload */ }
  }
  return _firestore;
}

// Compatibility shims so callers that imported `firestore` / `auth` as
// callables (the @react-native-firebase API) keep working without large
// rewrites. firestore() returns the Firestore instance, auth() returns
// the Auth instance.
export const firestore: () => Firestore = getFirestoreInstance;
export const auth: () => Auth = getAuthInstance;
