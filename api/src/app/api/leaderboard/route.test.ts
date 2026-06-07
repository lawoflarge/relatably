import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: { collection: vi.fn(), getAll: vi.fn() },
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { GET } from "./route";
import { adminAuth, adminFirestore } from "@/lib/firebase";

const buildReq = (qs: string, token?: string) => {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(`http://localhost/api/leaderboard${qs}`, { headers });
};

describe("GET /api/leaderboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("daily/global: returns entries from latest revealed question, filtered by shadowban", async () => {
    const questionsCollection: any = {
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [{ id: "q-latest", data: () => ({ text: "Q?" }) }],
            }),
          })),
        })),
      })),
    };
    const entriesGet = vi.fn().mockResolvedValue({
      docs: [
        { data: () => ({ user_id: "u1", score: 1500, daily_rank: 1, submitted_at: { toMillis: () => 1 } }) },
        { data: () => ({ user_id: "u2", score: 1000, daily_rank: 2, submitted_at: { toMillis: () => 2 } }) },
        { data: () => ({ user_id: "u-banned", score: 800, daily_rank: 3, submitted_at: { toMillis: () => 3 } }) },
      ],
    });
    const entriesCollection: any = {
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({ get: entriesGet })),
          })),
        })),
      })),
    };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "questions") return questionsCollection;
      if (name === "leaderboard_entries") return entriesCollection;
      if (name === "users") return {
        doc: (uid: string) => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({
              handle: `@${uid}`,
              is_public: true,
              shadowbanned: uid === "u-banned",
              locale: "en",
            }),
          }),
        }),
      };
      throw new Error(`unexpected ${name}`);
    });

    const res = await GET(buildReq("?period=daily&scope=global"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries.map((e: any) => e.user_id)).toEqual(["u1", "u2"]);
    expect(body.entries[0]).toMatchObject({ score: 1500, handle: "@u1" });
  });

  it("alltime/global: orders user_aggregates by alltime_score desc", async () => {
    const aggGet = vi.fn().mockResolvedValue({
      docs: [
        { id: "u1", data: () => ({ alltime_score: 5000, weekly_score: 1500 }) },
        { id: "u2", data: () => ({ alltime_score: 3000, weekly_score: 0 }) },
      ],
    });
    const aggCollection: any = {
      orderBy: vi.fn(() => ({ limit: vi.fn(() => ({ get: aggGet })) })),
    };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "user_aggregates") return aggCollection;
      if (name === "users") return {
        doc: (uid: string) => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ handle: `@${uid}`, is_public: true, shadowbanned: false, locale: "en" }),
          }),
        }),
      };
      throw new Error(`unexpected ${name}`);
    });

    const res = await GET(buildReq("?period=alltime&scope=global"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries.map((e: any) => e.score)).toEqual([5000, 3000]);
  });

  it("scope=friends: 401 without auth", async () => {
    const res = await GET(buildReq("?scope=friends"));
    expect(res.status).toBe(401);
  });

  it("scope=friends: filters by caller's friend set + self", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u1" });

    const friendshipsCollection: any = {
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn().mockResolvedValue({
            docs: [
              { data: () => ({ requester_id: "u1", accepter_id: "u2", status: "accepted" }) },
              { data: () => ({ requester_id: "u3", accepter_id: "u1", status: "accepted" }) },
            ],
          }),
        })),
      })),
    };

    const questionsCollection: any = {
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              empty: false,
              docs: [{ id: "q-latest", data: () => ({ text: "Q?" }) }],
            }),
          })),
        })),
      })),
    };

    const entriesGet = vi.fn().mockResolvedValue({
      docs: [
        { data: () => ({ user_id: "u1", score: 1500, daily_rank: 1, submitted_at: { toMillis: () => 1 } }) },
        { data: () => ({ user_id: "u2", score: 1000, daily_rank: 2, submitted_at: { toMillis: () => 2 } }) },
      ],
    });
    const entriesCollection: any = {
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(() => ({ get: entriesGet })),
            })),
          })),
        })),
      })),
    };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return friendshipsCollection;
      if (name === "questions") return questionsCollection;
      if (name === "leaderboard_entries") return entriesCollection;
      if (name === "users") return {
        doc: (uid: string) => ({
          get: vi.fn().mockResolvedValue({
            exists: true,
            data: () => ({ handle: `@${uid}`, is_public: true, shadowbanned: false, locale: "en" }),
          }),
        }),
      };
      throw new Error(`unexpected ${name}`);
    });

    const res = await GET(buildReq("?period=daily&scope=friends", "tok"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries.map((e: any) => e.user_id).sort()).toEqual(["u1", "u2"]);
  });

  it("daily/global with no revealed question serves the demo fallback (never empty for App Review)", async () => {
    const questionsCollection: any = {
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
          })),
        })),
      })),
    };
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "questions") return questionsCollection;
      throw new Error(`unexpected ${name}`);
    });

    const res = await GET(buildReq("?period=daily&scope=global"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // Guideline 1.2: the global Board must never be empty, or block/report have
    // no user to act on. Empty real data → permanent demo users.
    expect(body.entries.length).toBeGreaterThanOrEqual(6);
    expect(body.entries[0]).toMatchObject({ user_id: "demo-maya", handle: "maya" });
    // daily_rank present so the row renders a rank + visible block/report control.
    expect(body.entries[0].daily_rank).toBe(1);
  });

  it("alltime/global with empty user_aggregates serves the demo fallback", async () => {
    const aggCollection: any = {
      orderBy: vi.fn(() => ({ limit: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ docs: [] }) })) })),
    };
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "user_aggregates") return aggCollection;
      throw new Error(`unexpected ${name}`);
    });

    const res = await GET(buildReq("?period=alltime&scope=global"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries.length).toBeGreaterThanOrEqual(6);
    expect(body.entries.map((e: any) => e.user_id)).toContain("demo-maya");
  });

  it("scope=friends with no entries stays empty (never faked with demo users)", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "lonely" });
    const friendshipsCollection: any = {
      where: vi.fn(() => ({
        where: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ docs: [] }) })),
      })),
    };
    const questionsCollection: any = {
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ empty: false, docs: [{ id: "q-latest" }] }) })),
        })),
      })),
    };
    const entriesCollection: any = {
      where: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({ orderBy: vi.fn(() => ({ limit: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ docs: [] }) })) })) })),
        })),
      })),
    };
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") return friendshipsCollection;
      if (name === "questions") return questionsCollection;
      if (name === "leaderboard_entries") return entriesCollection;
      throw new Error(`unexpected ${name}`);
    });

    const res = await GET(buildReq("?period=daily&scope=friends", "tok"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entries).toHaveLength(0);
  });
});

describe("GET /api/leaderboard friend-scope chunked pagination (>30 friends)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("daily scope=friends with 45 friends queries leaderboard_entries in 2 chunks", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: "me" });

    // 44 friends, plus self = 45 uids. Will chunk to 30 + 15.
    const friendUids = Array.from({ length: 44 }, (_, i) => `friend-${i}`);

    // Latest revealed question.
    const questionsCollection = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        empty: false,
        docs: [{ id: "q-latest" }],
      }),
    };

    // Friendships.
    const friendshipsCollection = {
      where: vi.fn().mockReturnThis(),
      get: vi.fn()
        .mockResolvedValueOnce({ docs: friendUids.slice(0, 22).map((u, i) => ({ id: `out-${i}`, data: () => ({ accepter_id: u }) })) })
        .mockResolvedValueOnce({ docs: friendUids.slice(22).map((u, i) => ({ id: `in-${i}`, data: () => ({ requester_id: u }) })) }),
    };

    // Track which "in" chunks the route asks for.
    const inChunks: string[][] = [];

    const leaderboardCollection = {
      where: vi.fn().mockImplementation(function (this: any, field: string, op: string, val: unknown) {
        if (field === "user_id" && op === "in") inChunks.push(val as string[]);
        return this;
      }),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockImplementation(() => {
        // Each chunk returns 1 dummy entry.
        return Promise.resolve({
          docs: [
            { data: () => ({ user_id: `chunk-uid-${inChunks.length}`, score: 100 - inChunks.length, daily_rank: inChunks.length }) },
          ],
        });
      }),
    };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "questions")             return questionsCollection;
      if (name === "friendships")           return friendshipsCollection;
      if (name === "leaderboard_entries")   return leaderboardCollection;
      if (name === "users") {
        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({
              exists: true,
              data: () => ({ handle: "x", is_public: true, shadowbanned: false, locale: "en" }),
            }),
          })),
        };
      }
      if (name === "user_aggregates") return {};
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await GET(
      new Request("http://localhost/api/leaderboard?scope=friends&period=daily&limit=50", {
        headers: { authorization: "Bearer x" },
      }),
    );
    expect(res.status).toBe(200);
    // 45 uids → 2 chunks (30, 15).
    expect(inChunks).toHaveLength(2);
    expect(inChunks[0]).toHaveLength(30);
    expect(inChunks[1]).toHaveLength(15);

    const body = await res.json();
    // Two chunks, each returning 1 entry, both kept after sort+limit.
    expect(body.entries).toHaveLength(2);
  });

  it("weekly scope=friends chunks user_aggregates by __name__", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: "me" });
    const friendUids = Array.from({ length: 31 }, (_, i) => `friend-${i}`);

    const friendshipsCollection = {
      where: vi.fn().mockReturnThis(),
      get: vi.fn()
        .mockResolvedValueOnce({ docs: friendUids.map((u, i) => ({ id: `out-${i}`, data: () => ({ accepter_id: u }) })) })
        .mockResolvedValueOnce({ docs: [] }),
    };

    const inChunks: string[][] = [];
    const aggregatesCollection = {
      where: vi.fn().mockImplementation(function (this: any, field: string, op: string, val: unknown) {
        if (field === "__name__" && op === "in") inChunks.push(val as string[]);
        return this;
      }),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockImplementation(() => {
        return Promise.resolve({ docs: [] });
      }),
    };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships")     return friendshipsCollection;
      if (name === "user_aggregates") return aggregatesCollection;
      if (name === "users")           return { doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false }) })) };
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await GET(
      new Request("http://localhost/api/leaderboard?scope=friends&period=weekly&limit=50", {
        headers: { authorization: "Bearer x" },
      }),
    );
    expect(res.status).toBe(200);
    // 32 uids (31 friends + self) → 2 chunks (30, 2).
    expect(inChunks).toHaveLength(2);
    expect(inChunks[0]).toHaveLength(30);
    expect(inChunks[1]).toHaveLength(2);
  });
});
