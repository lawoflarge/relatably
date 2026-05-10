import { NextResponse } from "next/server";
import { adminFirestore, adminMessaging } from "@/lib/firebase";
import { runOnce } from "@/lib/idempotency";
import { getKillSwitch } from "@/lib/remoteConfig";
import { runTriggerDrop } from "@/lib/dropEngine/runTriggerDrop";
import { requireCronBearer } from "../_helpers";

// Cron endpoints must never be cached by Next or any CDN.
export const dynamic = "force-dynamic";

/**
 * Phase 6 architecture pivot: replaces the Cloud Functions
 * onSchedule(* * * * *) `triggerDrop` + onDocumentUpdated(questions/{id})
 * `fanoutPush` with a single HTTP endpoint called every 5 min by
 * GitHub Actions cron (.github/workflows/cron-trigger-drop.yml).
 */
export async function POST(req: Request): Promise<NextResponse> {
  const auth = requireCronBearer(req);
  if (auth) return auth;

  const dropEnabled = await getKillSwitch("drop_enabled", true);
  if (!dropEnabled) {
    return NextResponse.json({ skipped: "drop_enabled=false" }, { status: 200 });
  }

  const now = new Date();
  // 5-minute idempotency window matches the GH Actions cron cadence: each
  // 5-min bucket gets at most one run regardless of cron drift or retries.
  const bucket = `triggerDrop:${Math.floor(now.getTime() / (5 * 60 * 1000))}`;
  const result = await runOnce(bucket, async () =>
    runTriggerDrop(adminFirestore, adminMessaging, now),
  );

  if (result === null) {
    return NextResponse.json({ skipped: "already-ran-this-bucket" }, { status: 200 });
  }
  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
