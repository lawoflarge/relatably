import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: { collection: vi.fn() },
  adminAuth: { verifyIdToken: vi.fn() },
}));

import { GET } from "./route";
import { adminAuth, adminFirestore } from "@/lib/firebase";

const buildReq = (token?: string) => {
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/api/friends", { headers });
};

describe("GET /api/friends", () => {
  beforeEach(() => vi.clearAllMocks());

  it("401 without auth", async () => {
    const res = await GET(buildReq());
    expect(res.status).toBe(401);
  });

  it("returns merged accepted+pending friendships across both directions", async () => {
    (adminAuth.verifyIdToken as any).mockResolvedValueOnce({ uid: "u1" });

    const asRequester = {
      docs: [
        { id: "f-A", data: () => ({ requester_id: "u1", accepter_id: "u2", status: "accepted" }) },
      ],
    };
    const asAccepter = {
      docs: [
        { id: "f-B", data: () => ({ requester_id: "u3", accepter_id: "u1", status: "pending" }) },
      ],
    };

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name !== "friendships") throw new Error(`unexpected ${name}`);
      return {
        where: (field: string, _op: string, _value: string) => ({
          where: (_f2: string, _o2: string, _v2: string[]) => ({
            get: vi.fn().mockResolvedValue(field === "requester_id" ? asRequester : asAccepter),
          }),
        }),
      };
    });

    const res = await GET(buildReq("tok"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.friendships).toHaveLength(2);
    expect(body.friendships.map((f: any) => f.id).sort()).toEqual(["f-A", "f-B"]);
  });
});
