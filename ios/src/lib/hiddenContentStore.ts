// User-managed lists of UGC the local user has chosen not to see.
// Backs the Hide-cluster / Block-user mechanisms required by App Review
// Guideline 1.2. AsyncStorage (not SecureStore) because Keychain has a
// ~2KB-per-value limit on iOS that can fail for power users.

import AsyncStorage from "@react-native-async-storage/async-storage";

const HIDDEN_KEY = "ugc_hidden_clusters_v1";
const BLOCKED_KEY = "ugc_blocked_users_v1";

export interface HiddenCluster {
  id: string;
  text: string;
  hidden_at: number;
}

export interface BlockedUser {
  user_id: string;
  handle: string | null;
  blocked_at: number;
}

async function readJson<T>(key: string): Promise<T[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeJson<T>(key: string, value: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function getHiddenClusters(): Promise<HiddenCluster[]> {
  return readJson<HiddenCluster>(HIDDEN_KEY);
}

export async function getHiddenClusterIds(): Promise<Set<string>> {
  const list = await getHiddenClusters();
  return new Set(list.map((h) => h.id));
}

export async function hideCluster(input: { id: string; text: string }): Promise<void> {
  const list = await getHiddenClusters();
  if (list.some((h) => h.id === input.id)) return;
  list.unshift({ id: input.id, text: input.text, hidden_at: Date.now() });
  await writeJson(HIDDEN_KEY, list);
}

export async function unhideCluster(id: string): Promise<void> {
  const list = await getHiddenClusters();
  await writeJson(HIDDEN_KEY, list.filter((h) => h.id !== id));
}

export async function getBlockedUsers(): Promise<BlockedUser[]> {
  return readJson<BlockedUser>(BLOCKED_KEY);
}

export async function getBlockedUserIds(): Promise<Set<string>> {
  const list = await getBlockedUsers();
  return new Set(list.map((b) => b.user_id));
}

export async function addBlockedUser(input: {
  user_id: string;
  handle: string | null;
}): Promise<void> {
  const list = await getBlockedUsers();
  if (list.some((b) => b.user_id === input.user_id)) return;
  list.unshift({ user_id: input.user_id, handle: input.handle, blocked_at: Date.now() });
  await writeJson(BLOCKED_KEY, list);
}

export async function removeBlockedUser(user_id: string): Promise<void> {
  const list = await getBlockedUsers();
  await writeJson(BLOCKED_KEY, list.filter((b) => b.user_id !== user_id));
}
