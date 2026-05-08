import { hasSeenReveal, markRevealSeen } from "./revealStore";

jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (k: string) => store.get(k) ?? null),
    setItemAsync: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    __reset: () => store.clear(),
  };
});

const SecureStore = jest.requireMock("expo-secure-store") as any;

describe("revealStore", () => {
  beforeEach(() => {
    SecureStore.__reset();
    jest.clearAllMocks();
  });

  it("hasSeenReveal returns false when never marked", async () => {
    await expect(hasSeenReveal("q-1")).resolves.toBe(false);
  });

  it("hasSeenReveal returns true after markRevealSeen", async () => {
    await markRevealSeen("q-1");
    await expect(hasSeenReveal("q-1")).resolves.toBe(true);
  });

  it("hasSeenReveal isolates per question id", async () => {
    await markRevealSeen("q-1");
    await expect(hasSeenReveal("q-2")).resolves.toBe(false);
  });
});
