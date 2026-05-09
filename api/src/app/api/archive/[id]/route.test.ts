import { describe, it, expect, vi, beforeEach } from "vitest";
import { Timestamp } from "firebase-admin/firestore";

const { fakeFirestore } = vi.hoisted(() => ({
  fakeFirestore: { collection: vi.fn() },
}));

vi.mock("@/lib/firebase", () => ({
  adminFirestore: fakeFirestore,
}));

import { GET } from "./route";

function questionRefMock(getResult: { exists: boolean; data?: () => unknown; id: string }) {
  return {
    get: vi.fn().mockResolvedValue(getResult),
  };
}

describe("GET /api/archive/[id]", () => {
  beforeEach(() => {
    fakeFirestore.collection.mockReset();
  });

  it("returns 200 with question + top clusters when revealed", async () => {
    const ref = questionRefMock({
      exists: true,
      id: "q1",
      data: () => ({
        text: "what's the most overrated tourist trap?",
        status: "revealed",
        created_at: Timestamp.fromDate(new Date("2026-05-09T00:00:00Z")),
      }),
    });
    const clustersCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({
        docs: [
          { id: "c1", data: () => ({ canonical_text: "Pisa Tower", submission_count: 412, final_rank: 1, final_pct_of_total: 0.31 }) },
          { id: "c2", data: () => ({ canonical_text: "Eiffel Tower", submission_count: 80, final_rank: 2, final_pct_of_total: 0.06 }) },
        ],
      }),
    };
    fakeFirestore.collection.mockImplementation((name: string) => {
      if (name === "questions") return { doc: vi.fn().mockReturnValue(ref) };
      if (name === "answer_clusters") return clustersCol;
      throw new Error("unexpected collection " + name);
    });

    const req = new Request("http://localhost/api/archive/q1");
    const ctx = { params: Promise.resolve({ id: "q1" }) };
    const res = await GET(req, ctx);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      id: "q1",
      text: "what's the most overrated tourist trap?",
      created_at: "2026-05-09T00:00:00.000Z",
      top_clusters: [
        { id: "c1", canonical_text: "Pisa Tower", submission_count: 412, final_rank: 1, final_pct_of_total: 0.31 },
        { id: "c2", canonical_text: "Eiffel Tower", submission_count: 80, final_rank: 2, final_pct_of_total: 0.06 },
      ],
    });
    expect(clustersCol.limit).toHaveBeenCalledWith(50);
  });

  it("returns 404 when question doesn't exist", async () => {
    const ref = questionRefMock({ exists: false, id: "missing" });
    fakeFirestore.collection.mockImplementation((name: string) => {
      if (name === "questions") return { doc: vi.fn().mockReturnValue(ref) };
      throw new Error("unexpected collection " + name);
    });

    const req = new Request("http://localhost/api/archive/missing");
    const ctx = { params: Promise.resolve({ id: "missing" }) };
    const res = await GET(req, ctx);

    expect(res.status).toBe(404);
  });

  it("returns 404 when question exists but is not revealed", async () => {
    const ref = questionRefMock({
      exists: true,
      id: "q-live",
      data: () => ({ text: "live now", status: "live", created_at: Timestamp.now() }),
    });
    fakeFirestore.collection.mockImplementation((name: string) => {
      if (name === "questions") return { doc: vi.fn().mockReturnValue(ref) };
      throw new Error("unexpected collection " + name);
    });

    const req = new Request("http://localhost/api/archive/q-live");
    const ctx = { params: Promise.resolve({ id: "q-live" }) };
    const res = await GET(req, ctx);

    expect(res.status).toBe(404);
  });

  it("respects ?limit param within MAX (200)", async () => {
    const ref = questionRefMock({
      exists: true,
      id: "q1",
      data: () => ({
        text: "x",
        status: "revealed",
        created_at: Timestamp.now(),
      }),
    });
    const clustersCol = {
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ docs: [] }),
    };
    fakeFirestore.collection.mockImplementation((name: string) => {
      if (name === "questions") return { doc: vi.fn().mockReturnValue(ref) };
      if (name === "answer_clusters") return clustersCol;
      throw new Error("unexpected collection " + name);
    });

    const req = new Request("http://localhost/api/archive/q1?limit=999");
    const ctx = { params: Promise.resolve({ id: "q1" }) };
    await GET(req, ctx);

    expect(clustersCol.limit).toHaveBeenCalledWith(200);
  });
});
