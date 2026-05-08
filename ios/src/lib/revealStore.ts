import * as SecureStore from "expo-secure-store";

const PREFIX = "reveal_seen_";

export async function hasSeenReveal(questionId: string): Promise<boolean> {
  const v = await SecureStore.getItemAsync(`${PREFIX}${questionId}`);
  return v === "1";
}

export async function markRevealSeen(questionId: string): Promise<void> {
  await SecureStore.setItemAsync(`${PREFIX}${questionId}`, "1");
}
