import { createHash } from "node:crypto";

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashIp(req: Request): string {
  // Derive the platform-trusted client IP. The leftmost x-forwarded-for entry
  // is client-controlled and spoofable; only the rightmost entry is appended by
  // the trusted proxy. Prefer Vercel's dedicated header, then x-real-ip, then
  // the RIGHTMOST x-forwarded-for entry.
  const xff = req.headers.get("x-forwarded-for");
  const rightmostXff = xff
    ? xff.split(",").map((s) => s.trim()).filter(Boolean).at(-1)
    : undefined;
  const ip =
    req.headers.get("x-vercel-forwarded-for")?.trim() ||
    req.headers.get("x-real-ip")?.trim() ||
    rightmostXff ||
    "unknown";
  return createHash("sha256").update(ip).digest("hex");
}
