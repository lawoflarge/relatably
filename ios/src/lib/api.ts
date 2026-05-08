import type { TodayQuestion, SubmitRequest, SubmitResponse, DeviceRegisterPayload, Yesterday } from "../types/api";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export async function fetchTodayQuestion(): Promise<TodayQuestion> {
  const res = await fetch(`${BASE}/api/questions/today`);
  if (!res.ok) throw new Error(`fetchTodayQuestion: ${res.status}`);
  return res.json();
}

export async function submitAnswer(req: SubmitRequest): Promise<SubmitResponse> {
  const res = await fetch(`${BASE}/api/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
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
  if (!res.ok) {
    throw new Error(`register failed: ${res.status}`);
  }
}

export async function fetchYesterday(deviceToken?: string): Promise<Yesterday | null> {
  const url = new URL(`${BASE}/api/yesterday`);
  if (deviceToken) url.searchParams.set("device_token", deviceToken);
  const res = await fetch(url.toString());
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`yesterday failed: ${res.status}`);
  return (await res.json()) as Yesterday;
}
