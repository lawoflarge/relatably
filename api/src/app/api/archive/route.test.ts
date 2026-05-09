import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const { fakeFirestore } = vi.hoisted(() => ({
  fakeFirestore: {
    collection: vi.fn(),
  },
}));

vi.mock("@/lib/firebase", () => ({
  adminFirestore: fakeFirestore,
}));

import { GET } from "./route";

function makeQuestionDoc(id: string, text: string, createdAt: Date) {
  return {
    id,
    data: () => ({ text, created_at: Timestamp.fromDate(createdAt) }),
  };
}

function makeClusterDoc(id: string, canonical_text: string, final_rank: number) {
  return {
    id,
    data: () => ({ canonical_text, final_rank }),
  };
}

describe("GET /api/archive", () => {
  beforeEach(() => {
    fakeFirestore.collection.mockReset();
  });

  it("returns tiles ordered by created_at desc with default page size 20", async () => {
    const q1 = makeQuestionDoc("q1", "first?", new Date("2026-05-09T00:00:00Z"));
    const q2 = makeQuestionDoc("q2", "second?", new Date("2026-05-08T00:00:00Z"));
    const c1 = [
      makeClusterDoc("c1a", "yes", 1),
      makeClusterDoc("c1b", "no", 2),
      makeClusterDoc("c1c", "maybe", 3),
    ];
    const c2 = [makeClusterDoc("c2a", "italy", 1)];

    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      startAfter: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [q1, q2] }),
    };
    const clustersCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn()
        .mockResolvedValueOnce({ docs: c1 })
        .mockResolvedValueOnce({ docs: c2 }),
    };
    fakeFirestore.collection.mockImplementation((name: string) => {
      if (name === "questions") return questionsCol;
      if (name === "answer_clusters") return clustersCol;
      throw new Error("unexpected collection " + name);
    });

    const req = new Request("http://localhost/api/archive");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tiles).toHaveLength(2);
    expect(body.tiles[0]).toEqual({
      question_id: "q1",
      question_text: "first?",
      verdict_text: "yes",
      top_clusters: ["yes", "no", "maybe"],
      created_at: "2026-05-09T00:00:00.000Z",
    });
    expect(body.tiles[1]).toEqual({
      question_id: "q2",
      question_text: "second?",
      verdict_text: "italy",
      top_clusters: ["italy"],
      created_at: "2026-05-08T00:00:00.000Z",
    });
    expect(body.next_cursor).toBe("2026-05-08T00:00:00.000Z");

    expect(questionsCol.where).toHaveBeenCalledWith("status", "==", "revealed");
    expect(questionsCol.orderBy).toHaveBeenCalledWith("created_at", "desc");
    expect(questionsCol.limit).toHaveBeenCalledWith(20);
  });

  it("returns next_cursor=null when fewer tiles than page size returned", async () => {
    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      startAfter: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
    fakeFirestore.collection.mockImplementation((name: string) => {
      if (name === "questions") return questionsCol;
      if (name === "answer_clusters") return { where: vi.fn().mockReturnThis(), orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), get: vi.fn().mockResolvedValue({ docs: [] }) };
      throw new Error("unexpected collection " + name);
    });

    const req = new Request("http://localhost/api/archive");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.tiles).toEqual([]);
    expect(body.next_cursor).toBeNull();
  });

  it("applies cursor on subsequent page", async () => {
    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      startAfter: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
    fakeFirestore.collection.mockImplementation(() => questionsCol);

    const cursor = "2026-05-08T00:00:00.000Z";
    const req = new Request(`http://localhost/api/archive?cursor=${encodeURIComponent(cursor)}`);
    await GET(req);

    expect(questionsCol.startAfter).toHaveBeenCalledTimes(1);
    const startAfterArg = questionsCol.startAfter.mock.calls[0][0];
    // expect a Firestore Timestamp constructed from the cursor
    expect(startAfterArg.toDate().toISOString()).toBe(cursor);
  });

  it("ignores invalid cursor string and returns first page", async () => {
    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      startAfter: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
    fakeFirestore.collection.mockImplementation(() => questionsCol);

    const req = new Request("http://localhost/api/archive?cursor=not-a-date");
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(questionsCol.startAfter).not.toHaveBeenCalled();
  });

  it("respects ?limit query param within bounds", async () => {
    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      startAfter: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
    fakeFirestore.collection.mockImplementation(() => questionsCol);

    const req = new Request("http://localhost/api/archive?limit=5");
    await GET(req);

    expect(questionsCol.limit).toHaveBeenCalledWith(5);
  });

  it("clamps limit to MAX (50)", async () => {
    const questionsCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      startAfter: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
    fakeFirestore.collection.mockImplementation(() => questionsCol);

    const req = new Request("http://localhost/api/archive?limit=999");
    await GET(req);

    expect(questionsCol.limit).toHaveBeenCalledWith(50);
  });
});
