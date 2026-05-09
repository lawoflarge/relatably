"use client";

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";

function getConfig() {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
  };
}

let app: FirebaseApp | null = null;

function getClientApp(): FirebaseApp {
  if (app) return app;
  app = getApps().length > 0 ? getApp() : initializeApp(getConfig());
  return app;
}

export function getClientAuth() {
  return getAuth(getClientApp());
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(getClientAuth(), provider);
  return result.user;
}

export function signOutAdmin(): Promise<void> {
  return signOut(getClientAuth());
}

export function watchAuthState(callback: (user: User | null) => void) {
  return onAuthStateChanged(getClientAuth(), callback);
}

export function isAdminUid(uid: string): boolean {
  const raw = process.env.NEXT_PUBLIC_ADMIN_UIDS ?? "";
  const set = new Set(raw.split(",").map((s) => s.trim()).filter(Boolean));
  return set.has(uid);
}

export async function getAdminBearerToken(): Promise<string | null> {
  const user = getClientAuth().currentUser;
  if (!user) return null;
  return await user.getIdToken();
}
