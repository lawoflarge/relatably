import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => {
  const mockCollection = vi.fn();
  return {
    adminFirestore: { collection: mockCollection },
    adminAuth: { verifyIdToken: vi.fn() },
  };
});

import { GET } from "./route";
import { adminFirestore, adminAuth } from "@/lib/firebase";

const buildRequest = (auth?: string) =>
  new Request("http://localhost/api/friends", {
    method: "GET",
    headers: auth ? { authorization: `Bearer ${auth}` } : {},
  });

describe("GET /api/friends (enriched)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects without auth", async () => {
    const res = await GET(buildRequest());
    expect(res.status).toBe(401);
  });

  it("returns enriched outgoing + incoming friendships, drops shadowbanned", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: "me" });

    // Two outgoing accepted friendships (me → A, me → SHADOW).
    const outgoingDocs = [
      { id: "f1", data: () => ({ requester_id: "me", accepter_id: "A", status: "accepted" }) },
      { id: "f3", data: () => ({ requester_id: "me", accepter_id: "SHADOW", status: "accepted" }) },
    ];
    // One incoming pending friendship (B → me).
    const incomingDocs = [
      { id: "f2", data: () => ({ requester_id: "B", accepter_id: "me", status: "pending" }) },
    ];

    const userDocs: Record<string, any> = {
      A: { exists: true, data: () => ({ handle: "alice", is_public: true, shadowbanned: false, locale: "en" }) },
      B: { exists: true, data: () => ({ handle: "bob",   is_public: true, shadowbanned: false, locale: "de" }) },
      SHADOW: { exists: true, data: () => ({ handle: "shadow", is_public: true, shadowbanned: true, locale: "en" }) },
    };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") {
        return {
          where: vi.fn().mockReturnThis(),
          get: vi.fn()
            .mockResolvedValueOnce({ docs: outgoingDocs })
            .mockResolvedValueOnce({ docs: incomingDocs }),
        };
      }
      if (name === "users") {
        return {
          doc: vi.fn((uid: string) => ({
            get: vi.fn().mockResolvedValue(userDocs[uid] ?? { exists: false }),
          })),
        };
      }
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await GET(buildRequest("token-me"));
    expect(res.status).toBe(200);
    const body = await res.json();
    // SHADOW friend dropped.
    expect(body.friendships).toHaveLength(2);

    const a = body.friendships.find((f: any) => f.friend_user_id === "A");
    expect(a).toMatchObject({
      id: "f1",
      friend_user_id: "A",
      handle: "alice",
      locale: "en",
      status: "accepted",
      direction: "outgoing",
    });

    const b = body.friendships.find((f: any) => f.friend_user_id === "B");
    expect(b).toMatchObject({
      id: "f2",
      friend_user_id: "B",
      handle: "bob",
      locale: "de",
      status: "pending",
      direction: "incoming",
    });
  });

  it("drops friendships whose target user doc is missing", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValue({ uid: "me" });
    const outgoingDocs = [
      { id: "f1", data: () => ({ requester_id: "me", accepter_id: "GHOST", status: "accepted" }) },
    ];
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "friendships") {
        return {
          where: vi.fn().mockReturnThis(),
          get: vi.fn()
            .mockResolvedValueOnce({ docs: outgoingDocs })
            .mockResolvedValueOnce({ docs: [] }),
        };
      }
      if (name === "users") {
        return {
          doc: vi.fn(() => ({
            get: vi.fn().mockResolvedValue({ exists: false }),
          })),
        };
      }
      throw new Error(`unexpected collection ${name}`);
    });

    const res = await GET(buildRequest("token-me"));
    const body = await res.json();
    expect(body.friendships).toHaveLength(0);
  });
});
