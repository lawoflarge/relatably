"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { signInWithGoogle, signOutAdmin, watchAuthState, isAdminUid } from "@/lib/firebaseClient";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = watchAuthState((u) => {
      setUser(u);
      setReady(true);
    });
    return () => unsub();
  }, []);

  if (!ready) {
    return <main style={shellStyle}><p>loading…</p></main>;
  }

  if (!user) {
    return (
      <main style={shellStyle}>
        <h1>Relatably Admin</h1>
        <p>Sign in with your admin Google account.</p>
        <button
          type="button"
          onClick={() => {
            signInWithGoogle().catch((err) => alert("sign-in failed: " + (err?.message ?? "unknown")));
          }}
          style={btnStyle}
        >
          Sign in with Google
        </button>
      </main>
    );
  }

  if (!isAdminUid(user.uid)) {
    return (
      <main style={shellStyle}>
        <h1>Not authorized</h1>
        <p>
          Signed in as <strong>{user.email}</strong> (uid <code>{user.uid}</code>) but this account is not in the admin
          allowlist. Add this uid to <code>NEXT_PUBLIC_ADMIN_UIDS</code> + <code>ADMIN_UIDS</code> and re-deploy.
        </p>
        <button type="button" onClick={() => signOutAdmin()} style={btnStyle}>Sign out</button>
      </main>
    );
  }

  return (
    <main style={shellStyle}>
      <header style={headerStyle}>
        <h1 style={{ margin: 0 }}>Relatably Admin</h1>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ color: "#888", fontSize: 12 }}>{user.email}</span>
          <button type="button" onClick={() => signOutAdmin()} style={btnStyle}>Sign out</button>
        </div>
      </header>
      {children}
    </main>
  );
}

const shellStyle: React.CSSProperties = {
  fontFamily: "system-ui, sans-serif",
  maxWidth: 960,
  margin: "0 auto",
  padding: 24,
  color: "#fff",
  backgroundColor: "#000",
  minHeight: "100vh",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  borderBottom: "1px solid #222",
  paddingBottom: 12,
  marginBottom: 24,
};

const btnStyle: React.CSSProperties = {
  background: "#1f1f1f",
  color: "#fff",
  border: "1px solid #333",
  borderRadius: 6,
  padding: "8px 14px",
  cursor: "pointer",
};
