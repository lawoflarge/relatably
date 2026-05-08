import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => ({
  adminFirestore: {
    collection: vi.fn(),
  },
  adminAuth: {},
}));

import { GET } from "./route";
import { adminFirestore } from "@/lib/firebase";

describe("GET /api/questions/today", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the live question with id + text", async () => {
    const mockDoc = {
      id: "q-uuid-1",
      data: () => ({ text: "what's the most overrated tourist trap?", status: "live" }),
    };
    (adminFirestore.collection as any).mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: false, docs: [mockDoc] }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      id: "q-uuid-1",
      text: "what's the most overrated tourist trap?",
    });
  });

  it("returns 404 when no live question exists", async () => {
    (adminFirestore.collection as any).mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
        }),
      }),
    });

    const res = await GET();
    expect(res.status).toBe(404);
  });
});
