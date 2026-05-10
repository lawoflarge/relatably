import { NextResponse } from "next/server";

/**
 * Bearer-token auth gate for /api/cron/* endpoints. Compares
 * `Authorization: Bearer ${CRON_SECRET}` against the env var. Returns
 * `null` on success (caller continues) or a 401 NextResponse on failure.
 *
 * GitHub Actions cron workflows pass this header; see
 * .github/workflows/cron-trigger-drop.yml.
 */
export function requireCronBearer(req: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
  }
  const header = req.headers.get("authorization") ?? "";
  const m = header.match(/^Bearer\s+(.+)$/);
  if (!m || m[1] !== expected) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return null;
}
