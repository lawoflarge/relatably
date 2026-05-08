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

  it("returns empty when no revealed question exists yet", async () => {
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
    expect(body.entries).toHaveLength(0);
  });
});
