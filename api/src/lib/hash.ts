import { createHash } from "node:crypto";

export function hashDeviceToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashIp(req: Request): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return createHash("sha256").update(ip).digest("hex");
}
