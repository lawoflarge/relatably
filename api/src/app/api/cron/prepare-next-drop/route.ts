import { NextResponse } from "next/server";
import { adminFirestore } from "@/lib/firebase";
import { runOnce } from "@/lib/idempotency";
import { runPrepareNextDrop } from "@/lib/dropEngine/runPrepareNextDrop";
import { requireCronBearer } from "../_helpers";

export const dynamic = "force-dynamic";

/**
 * Phase 6 architecture pivot: replaces the Cloud Functions
 * onSchedule(0 0 * * *) `prepareNextDrop` with an HTTP endpoint called
 * daily at 00:00 UTC by GitHub Actions cron
 * (.github/workflows/cron-prepare-next-drop.yml).
 */
export async function POST(req: Request): Promise<NextResponse> {
  const auth = requireCronBearer(req);
  if (auth) return auth;

  const now = new Date();
  // 1-day idempotency window: each UTC day gets exactly one assignment
  // even if the cron fires twice or workflow_dispatch is clicked manually.
  const dayBucket = `prepareNextDrop:${Math.floor(now.getTime() / (24 * 60 * 60 * 1000))}`;
  const result = await runOnce(dayBucket, async () =>
    runPrepareNextDrop(adminFirestore, now),
  );

  if (result === null) {
    return NextResponse.json({ skipped: "already-ran-today" }, { status: 200 });
  }
  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
