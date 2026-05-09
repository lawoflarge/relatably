"use client";

import { useEffect, useState } from "react";
import { getAdminBearerToken } from "@/lib/firebaseClient";

interface Candidate {
  id: string;
  candidate_text: string;
  status: "pending" | "approved" | "rejected";
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

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const body = await adminFetch<{ candidates: Candidate[] }>("/api/admin/candidates");
      setCandidates(body.candidates);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function create() {
    if (!text.trim()) return;
    try {
      await adminFetch("/api/admin/candidates", {
        method: "POST",
        body: JSON.stringify({ candidate_text: text.trim() }),
      });
      setText("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function act(id: string, action: "approve" | "reject") {
    try {
      await adminFetch(`/api/admin/candidates/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <section>
      <h2>Question candidates</h2>
      {error && <p style={{ color: "#f87171" }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="new candidate question text…"
          style={inputStyle}
        />
        <button type="button" onClick={create} style={btnStyle}>Create</button>
      </div>
      {loading ? <p>loading…</p> : null}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid #333" }}>
            <th style={thStyle}>text</th>
            <th style={thStyle}>status</th>
            <th style={thStyle}>created</th>
            <th style={thStyle}>actions</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr key={c.id} style={{ borderBottom: "1px solid #1a1a1a" }}>
              <td style={tdStyle}>{c.candidate_text}</td>
              <td style={tdStyle}>{c.status}</td>
              <td style={tdStyle}>{new Date(c.created_at).toLocaleString()}</td>
              <td style={tdStyle}>
                {c.status === "pending" ? (
                  <>
                    <button type="button" onClick={() => act(c.id, "approve")} style={btnStyle}>Approve</button>{" "}
                    <button type="button" onClick={() => act(c.id, "reject")} style={btnStyle}>Reject</button>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
          {candidates.length === 0 && !loading ? (
            <tr><td colSpan={4} style={{ padding: 16, color: "#888" }}>no candidates yet — create one above.</td></tr>
          ) : null}
        </tbody>
      </table>
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: "#0a0a0a",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 6,
  padding: "8px 12px",
};
const btnStyle: React.CSSProperties = {
  background: "#1f1f1f",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 6,
  padding: "8px 14px",
  cursor: "pointer",
};
const thStyle: React.CSSProperties = { textAlign: "left", padding: 8, color: "#888", fontSize: 12 };
const tdStyle: React.CSSProperties = { padding: 8, fontSize: 14, verticalAlign: "top" };
