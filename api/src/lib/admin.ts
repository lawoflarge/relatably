import type { DecodedIdToken } from "firebase-admin/auth";
import { requireAuth } from "@/lib/auth";

export type RequireAdminResult =
  | { kind: "no_auth" }
  | { kind: "not_admin"; decoded: DecodedIdToken }
  | { kind: "ok"; decoded: DecodedIdToken };

function adminUids(): Set<string> {
  const raw = process.env.ADMIN_UIDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

export async function requireAdmin(req: Request): Promise<RequireAdminResult> {
  const decoded = await requireAuth(req);
  if (!decoded) return { kind: "no_auth" };
  if (!adminUids().has(decoded.uid)) return { kind: "not_admin", decoded };
  return { kind: "ok", decoded };
}
