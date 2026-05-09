"use client";

import { useState } from "react";
import { getAdminBearerToken } from "@/lib/firebaseClient";

export default function TriggerPage() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function trigger() {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const token = await getAdminBearerToken();
      if (!token) throw new Error("not signed in");
      const res = await fetch("/api/admin/trigger-drop", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `${res.status}`);
      setResult(`triggered question ${body.question_id} — minute cron picks it up within ≤${body.will_fire_within_seconds}s`);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <h2>Manually trigger next drop</h2>
      <p style={{ color: "#888", maxWidth: 560 }}>
        Sets the oldest scheduled question's <code>scheduled_drop_at</code> to now.
        The existing minute cron picks it up within ≤60 seconds.
        Use only for soft-launch / debugging — production drops fire on the natural random schedule.
      </p>
      <button type="button" onClick={trigger} disabled={busy} style={btnStyle}>
        {busy ? "triggering…" : "Trigger next drop now"}
      </button>
      {result && <p style={{ color: "#86efac", marginTop: 12 }}>{result}</p>}
      {error && <p style={{ color: "#f87171", marginTop: 12 }}>{error}</p>}
    </section>
  );
}

const btnStyle: React.CSSProperties = {
  background: "#1f1f1f",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 6,
  padding: "10px 16px",
  cursor: "pointer",
  fontSize: 14,
};
