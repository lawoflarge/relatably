import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminFirestore } from "@/lib/firebase";
import type { DecodedIdToken } from "firebase-admin/auth";

export async function requireAuth(req: Request): Promise<DecodedIdToken | null> {
  const header = req.headers.get("authorization") ?? req.headers.get("Authorization");
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) return null;
  const token = match[1].trim();
  if (!token) return null;
  try {
    return await adminAuth.verifyIdToken(token);
  } catch {
    return null;
  }
}

export interface UserProfile {
  uid: string;
  handle: string | null;
  is_public: boolean;
  locale: string;
  shadowbanned: boolean;
}

export async function getOrCreateUserDoc(uid: string, locale: string): Promise<UserProfile> {
  const ref = adminFirestore.collection("users").doc(uid);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set(
      {
        handle: null,
        is_public: true,
        locale,
        shadowbanned: false,
        created_at: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return { uid, handle: null, is_public: true, locale, shadowbanned: false };
  }
  const data = snap.data() as {
    handle: string | null;
    is_public: boolean;
    locale: string;
    shadowbanned: boolean;
  };
  return {
    uid,
    handle: data.handle ?? null,
    is_public: data.is_public ?? true,
    locale: data.locale ?? locale,
    shadowbanned: data.shadowbanned ?? false,
  };
}
