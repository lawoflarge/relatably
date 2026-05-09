import type {
  TodayQuestion, SubmitRequest, SubmitResponse,
  DeviceRegisterPayload, Yesterday,
  AuthMeResponse, Friendship, LeaderboardEntry, LeaderboardPeriod, LeaderboardScope,
  ShareTrackRequest, ShareTrackResponse,
} from "../types/api";
import { getIdToken } from "@/src/lib/auth";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function fetchTodayQuestion(): Promise<TodayQuestion> {
  const res = await fetch(`${BASE}/api/questions/today`);
  if (!res.ok) throw new Error(`fetchTodayQuestion: ${res.status}`);
  return res.json();
}

export async function submitAnswer(req: SubmitRequest): Promise<SubmitResponse> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/submit`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `submit: ${res.status}`);
  }
  return res.json();
}

export async function registerDevice(payload: DeviceRegisterPayload): Promise<void> {
  const res = await fetch(`${BASE}/api/devices/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`register failed: ${res.status}`);
}

export async function fetchYesterday(deviceToken?: string): Promise<Yesterday | null> {
  const url = new URL(`${BASE}/api/yesterday`);
  if (deviceToken) url.searchParams.set("device_token", deviceToken);
  const res = await fetch(url.toString());
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`yesterday failed: ${res.status}`);
  return (await res.json()) as Yesterday;
}

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/auth/me`, { method: "POST", headers: auth });
  if (!res.ok) throw new Error(`auth/me failed: ${res.status}`);
  return res.json();
}

export async function requestFriend(targetUserId: string): Promise<{ id: string; status: string }> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/friends/request`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify({ target_user_id: targetUserId }),
  });
  if (!res.ok) throw new Error(`requestFriend: ${res.status}`);
  return res.json();
}

export async function acceptFriend(friendshipId: string): Promise<{ id: string; status: string }> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/friends/accept`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify({ friendship_id: friendshipId }),
  });
  if (!res.ok) throw new Error(`acceptFriend: ${res.status}`);
  return res.json();
}

export async function removeFriend(friendshipId: string): Promise<void> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/friends/${encodeURIComponent(friendshipId)}`, {
    method: "DELETE",
    headers: auth,
  });
  if (!res.ok) throw new Error(`removeFriend: ${res.status}`);
}

export async function fetchFriends(): Promise<{ friendships: Friendship[] }> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/friends`, { headers: auth });
  if (!res.ok) throw new Error(`fetchFriends: ${res.status}`);
  return res.json();
}

export async function fetchLeaderboard(opts: {
  period: LeaderboardPeriod;
  scope: LeaderboardScope;
  limit?: number;
}): Promise<{ entries: LeaderboardEntry[] }> {
  const url = new URL(`${BASE}/api/leaderboard`);
  url.searchParams.set("period", opts.period);
  url.searchParams.set("scope", opts.scope);
  if (opts.limit) url.searchParams.set("limit", String(opts.limit));

  const headers = opts.scope === "friends" ? await authHeaders() : {};
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error(`fetchLeaderboard: ${res.status}`);
  return res.json();
}

export async function trackShare(req: ShareTrackRequest): Promise<ShareTrackResponse> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/share/track`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`trackShare: ${res.status}`);
  return res.json();
}
