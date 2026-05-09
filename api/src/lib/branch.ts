import { createHmac } from "node:crypto";

export type BannerType = "todays_take" | "verdict" | "called_it";

export interface ReferralPayload {
  user_id: string | null;
  question_id: string;
  banner_type: BannerType;
  ts: number;
}

export interface VerifiedReferral {
  user_id: string | null;
  question_id: string | null;
  banner_type: BannerType | null;
  ts: number;
  dev?: boolean;
}

let cachedSecret: string | undefined;

export function __resetBranchForTest(): void {
  cachedSecret = undefined;
}

function getSecret(): string {
  if (!cachedSecret) cachedSecret = process.env.BRANCH_REFERRAL_SECRET;
  return cachedSecret ?? "";
}

function b64urlEncode(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function b64urlDecode(s: string): Buffer | null {
  try {
    const padded = s.replace(/-/g, "+").replace(/_/g, "/");
    const padding = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
    return Buffer.from(padded + padding, "base64");
  } catch {
    return null;
  }
}

export function signReferralCode(payload: ReferralPayload): string {
  const secret = getSecret();
  if (!secret) return "dev-referral.dev";
  const json = JSON.stringify(payload);
  const payloadEncoded = b64urlEncode(json);
  const sig = createHmac("sha256", secret).update(payloadEncoded).digest();
  return `${payloadEncoded}.${b64urlEncode(sig)}`;
}

export function verifyReferralCode(code: string): VerifiedReferral | null {
  if (code === "dev-referral.dev") {
    return { user_id: null, question_id: null, banner_type: null, ts: 0, dev: true };
  }
  const secret = getSecret();
  if (!secret) return null;
  const parts = code.split(".");
  if (parts.length !== 2) return null;
  const [payloadEncoded, sigEncoded] = parts;
  const expectedSig = b64urlEncode(
    createHmac("sha256", secret).update(payloadEncoded).digest(),
  );
  // Constant-time compare via length check + char-by-char.
  if (expectedSig.length !== sigEncoded.length) return null;
  let diff = 0;
  for (let i = 0; i < expectedSig.length; i++) {
    diff |= expectedSig.charCodeAt(i) ^ sigEncoded.charCodeAt(i);
  }
  if (diff !== 0) return null;

  const decoded = b64urlDecode(payloadEncoded);
  if (!decoded) return null;
  try {
    const obj = JSON.parse(decoded.toString("utf8")) as ReferralPayload;
    return {
      user_id: obj.user_id ?? null,
      question_id: obj.question_id,
      banner_type: obj.banner_type,
      ts: obj.ts,
    };
  } catch {
    return null;
  }
}
