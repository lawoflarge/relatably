import {
  fetchAuthMe,
  requestFriend,
  acceptFriend,
  removeFriend,
  fetchFriends,
  fetchLeaderboard,
} from "./api";

jest.mock("@/src/lib/auth", () => ({
  getIdToken: jest.fn(),
}));

import * as authMod from "@/src/lib/auth";

const fetchMock = jest.fn();
(global as any).fetch = fetchMock;

const okJson = (body: any, status = 200) =>
  Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as any);

describe("api clients with Authorization header", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authMod.getIdToken as jest.Mock).mockResolvedValue("id-token-1");
  });

  it("fetchAuthMe POSTs with Authorization Bearer", async () => {
    fetchMock.mockReturnValueOnce(okJson({ uid: "u1", handle: null, is_public: true, locale: "en", shadowbanned: false }));
    const res = await fetchAuthMe();
    expect(res).toMatchObject({ uid: "u1" });
    const init = fetchMock.mock.calls[0][1];
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer id-token-1");
  });

  it("requestFriend includes target_user_id in body and bearer in header", async () => {
    fetchMock.mockReturnValueOnce(okJson({ id: "fid", status: "pending" }));
    const res = await requestFriend("u2");
    expect(res).toMatchObject({ id: "fid", status: "pending" });
    const init = fetchMock.mock.calls[0][1];
    expect(JSON.parse(init.body)).toEqual({ target_user_id: "u2" });
    expect(init.headers.authorization).toBe("Bearer id-token-1");
  });

  it("acceptFriend POSTs friendship_id with bearer", async () => {
    fetchMock.mockReturnValueOnce(okJson({ id: "fid", status: "accepted" }));
    await acceptFriend("fid");
    const init = fetchMock.mock.calls[0][1];
    expect(JSON.parse(init.body)).toEqual({ friendship_id: "fid" });
  });

  it("removeFriend issues DELETE", async () => {
    fetchMock.mockReturnValueOnce(okJson({ ok: true }));
    await removeFriend("fid");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("DELETE");
  });

  it("fetchFriends GETs and returns friendships array", async () => {
    fetchMock.mockReturnValueOnce(okJson({ friendships: [{ id: "f1" }] }));
    const res = await fetchFriends();
    expect(res.friendships).toHaveLength(1);
  });

  it("fetchLeaderboard appends period+scope query string", async () => {
    fetchMock.mockReturnValueOnce(okJson({ entries: [] }));
    await fetchLeaderboard({ period: "daily", scope: "global" });
    const url: string = fetchMock.mock.calls[0][0];
    expect(url).toContain("period=daily");
    expect(url).toContain("scope=global");
  });

  it("fetchLeaderboard scope=friends includes Authorization header", async () => {
    fetchMock.mockReturnValueOnce(okJson({ entries: [] }));
    await fetchLeaderboard({ period: "weekly", scope: "friends" });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers.authorization).toBe("Bearer id-token-1");
  });

  it("fetchAuthMe still attempts when getIdToken returns null (server returns 401)", async () => {
    (authMod.getIdToken as jest.Mock).mockResolvedValueOnce(null);
    fetchMock.mockReturnValueOnce(okJson({ error: "unauthorized" }, 401));
    await expect(fetchAuthMe()).rejects.toThrow();
  });
});
