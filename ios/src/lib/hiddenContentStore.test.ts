jest.mock("@react-native-async-storage/async-storage", () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      removeItem: jest.fn(async (k: string) => {
        store.delete(k);
      }),
    },
    __reset: () => store.clear(),
  };
});

import {
  hideCluster,
  unhideCluster,
  getHiddenClusters,
  getHiddenClusterIds,
  addBlockedUser,
  removeBlockedUser,
  getBlockedUsers,
  getBlockedUserIds,
} from "./hiddenContentStore";

const AsyncStorage = jest.requireMock(
  "@react-native-async-storage/async-storage",
) as { __reset: () => void };

describe("hiddenContentStore — clusters", () => {
  beforeEach(() => {
    AsyncStorage.__reset();
    jest.clearAllMocks();
  });

  it("returns empty when nothing hidden", async () => {
    await expect(getHiddenClusters()).resolves.toEqual([]);
    await expect(getHiddenClusterIds()).resolves.toEqual(new Set());
  });

  it("hideCluster persists across reads", async () => {
    await hideCluster({ id: "c1", text: "AI" });
    const list = await getHiddenClusters();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe("c1");
    expect(list[0].text).toBe("AI");
    expect(typeof list[0].hidden_at).toBe("number");
  });

  it("hideCluster is idempotent for repeated id", async () => {
    await hideCluster({ id: "c1", text: "AI" });
    await hideCluster({ id: "c1", text: "AI" });
    await expect(getHiddenClusters()).resolves.toHaveLength(1);
  });

  it("getHiddenClusterIds returns a Set", async () => {
    await hideCluster({ id: "c1", text: "AI" });
    await hideCluster({ id: "c2", text: "Bitcoin" });
    const ids = await getHiddenClusterIds();
    expect(ids.has("c1")).toBe(true);
    expect(ids.has("c2")).toBe(true);
    expect(ids.has("c3")).toBe(false);
  });

  it("unhideCluster removes only the specified id", async () => {
    await hideCluster({ id: "c1", text: "AI" });
    await hideCluster({ id: "c2", text: "Bitcoin" });
    await unhideCluster("c1");
    const ids = await getHiddenClusterIds();
    expect(ids.has("c1")).toBe(false);
    expect(ids.has("c2")).toBe(true);
  });
});

describe("hiddenContentStore — users", () => {
  beforeEach(() => {
    AsyncStorage.__reset();
    jest.clearAllMocks();
  });

  it("addBlockedUser stores handle and timestamp", async () => {
    await addBlockedUser({ user_id: "u1", handle: "alice" });
    const list = await getBlockedUsers();
    expect(list).toHaveLength(1);
    expect(list[0].user_id).toBe("u1");
    expect(list[0].handle).toBe("alice");
    expect(typeof list[0].blocked_at).toBe("number");
  });

  it("handle can be null", async () => {
    await addBlockedUser({ user_id: "u1", handle: null });
    const list = await getBlockedUsers();
    expect(list[0].handle).toBeNull();
  });

  it("addBlockedUser is idempotent", async () => {
    await addBlockedUser({ user_id: "u1", handle: "alice" });
    await addBlockedUser({ user_id: "u1", handle: "alice" });
    await expect(getBlockedUsers()).resolves.toHaveLength(1);
  });

  it("removeBlockedUser leaves other entries", async () => {
    await addBlockedUser({ user_id: "u1", handle: "alice" });
    await addBlockedUser({ user_id: "u2", handle: "bob" });
    await removeBlockedUser("u1");
    const ids = await getBlockedUserIds();
    expect(ids.has("u1")).toBe(false);
    expect(ids.has("u2")).toBe(true);
  });
});
