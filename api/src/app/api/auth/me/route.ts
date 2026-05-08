import { NextResponse } from "next/server";
import { requireAuth, getOrCreateUserDoc } from "@/lib/auth";

export async function POST(req: Request) {
  const decoded = await requireAuth(req);
  if (!decoded) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const locale = req.headers.get("accept-language")?.split(",")[0]?.trim() ?? "en";
  const profile = await getOrCreateUserDoc(decoded.uid, locale);
  return NextResponse.json(profile);
}
