"use client";

import { useEffect, useState } from "react";
import { getAdminBearerToken } from "@/lib/firebaseClient";

interface Question {
  id: string;
  text: string;
  status: "scheduled" | "live";
  scheduled_drop_at: string | null;
  created_at: string;
}

async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getAdminBearerToken();
  if (!token) throw new Error("not signed in");
  const res = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status}: ${text}`);
  }
  return (await res.json()) as T;
}

function defaultDropTime(): string {
  // tomorrow at 12:00 UTC, formatted for <input type="datetime-local">
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setUTCHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function SchedulePage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const body = await adminFetch<{ questions: Question[] }>("/api/admin/questions");
      setQuestions(body.questions);
      const init: Record<string, string> = {};
      for (const q of body.questions) {
        init[q.id] = q.scheduled_drop_at ? q.scheduled_drop_at.slice(0, 16) : defaultDropTime();
      }
      setEditing(init);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function save(id: string) {
    const localValue = editing[id];
    if (!localValue) return;
    try {
      const iso = new Date(localValue).toISOString();
      await adminFetch(`/api/admin/questions/${id}/schedule`, {
        method: "POST",
        body: JSON.stringify({ scheduled_drop_at: iso }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section>
      <h2>Scheduled + live questions</h2>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      {loading ? <p>loading…</p> : null}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={thStyle}>text</th>
            <th style={thStyle}>status</th>
            <th style={thStyle}>current drop_at</th>
            <th style={thStyle}>set new drop_at</th>
            <th style={thStyle}>action</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr key={q.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
              <td style={tdStyle}>{q.text}</td>
              <td style={tdStyle}>{q.status}</td>
              <td style={tdStyle}>{q.scheduled_drop_at ? new Date(q.scheduled_drop_at).toLocaleString() : "—"}</td>
              <td style={tdStyle}>
                <input
                  type="datetime-local"
                  value={editing[q.id] ?? ""}
                  onChange={(e) => setEditing((p) => ({ ...p, [q.id]: e.target.value }))}
                  disabled={q.status !== "scheduled"}
                  style={inputStyle}
                />
              </td>
              <td style={tdStyle}>
                <button type="button" onClick={() => save(q.id)} disabled={q.status !== "scheduled"} style={btnStyle}>
                  Save
                </button>
              </td>
            </tr>
          ))}
          {questions.length === 0 && !loading ? (
            <tr><td colSpan={5} style={{ padding: 16, color: "#888" }}>no scheduled or live questions.</td></tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  background: "#0a0a0a",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 6,
  padding: "6px 8px",
};
const btnStyle: React.CSSProperties = {
  background: "#1f1f1f",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 6,
  padding: "6px 12px",
  cursor: "pointer",
};
const thStyle: React.CSSProperties = { textAlign: "left", padding: 8, color: "#888", fontSize: 12 };
const tdStyle: React.CSSProperties = { padding: 8, fontSize: 14, verticalAlign: "top" };
