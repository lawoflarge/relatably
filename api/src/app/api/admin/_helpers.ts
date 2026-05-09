import { NextResponse } from "next/server";

export function gateResponse(kind: "no_auth" | "not_admin"): NextResponse {
  if (kind === "no_auth") return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ error: "forbidden" }, { status: 403 });
}
