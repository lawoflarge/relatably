import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/firebase", () => {
  return {
    adminFirestore: {
      collection: vi.fn(),
    },
    adminAuth: {},
  };
});

import { GET } from "./route";
import { adminFirestore } from "@/lib/firebase";

const buildRequest = (url: string) => new Request(url);

describe("GET /api/yesterday", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when there is no revealed question", async () => {
    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "questions") {
        return {
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected ${name}`);
    });

    const res = await GET(buildRequest("http://localhost/api/yesterday"));
    expect(res.status).toBe(404);
  });

  it("returns yesterday's question text + top-10 clusters", async () => {
    const questionDoc = {
      id: "q-yesterday",
      data: () => ({ text: "what's the most overrated tourist trap?", status: "revealed" }),
    };
    const clusterDocs = [
      { id: "c-1", data: () => ({ canonical_text: "pisa tower", submission_count: 412381, final_rank: 1, final_pct_of_total: 0.32 }) },
      { id: "c-2", data: () => ({ canonical_text: "louvre", submission_count: 200000, final_rank: 2, final_pct_of_total: 0.15 }) },
    ];

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "questions") {
        return {
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                get: vi.fn().mockResolvedValue({ empty: false, docs: [questionDoc] }),
              }),
            }),
          }),
        };
      }
      if (name === "answer_clusters") {
        return {
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                get: vi.fn().mockResolvedValue({ empty: false, docs: clusterDocs }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected ${name}`);
    });

    const res = await GET(buildRequest("http://localhost/api/yesterday"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("q-yesterday");
    expect(body.text).toBe("what's the most overrated tourist trap?");
    expect(body.top_clusters).toHaveLength(2);
    expect(body.top_clusters[0]).toEqual({
      id: "c-1",
      canonical_text: "pisa tower",
      submission_count: 412381,
      final_rank: 1,
      final_pct_of_total: 0.32,
    });
    expect(body.self_cluster_id).toBeNull();
  });

  it("includes self_cluster_id when device_token query param is provided and matches", async () => {
    const questionDoc = {
      id: "q-yesterday",
      data: () => ({ text: "q", status: "revealed" }),
    };
    const clusterDocs = [
      { id: "c-1", data: () => ({ canonical_text: "pisa tower", submission_count: 100, final_rank: 1, final_pct_of_total: 1 }) },
    ];
    const submissionDocs = [
      { data: () => ({ normalized_cluster_id: "c-self-cluster-id" }) },
    ];

    (adminFirestore.collection as any).mockImplementation((name: string) => {
      if (name === "questions") {
        return {
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                get: vi.fn().mockResolvedValue({ empty: false, docs: [questionDoc] }),
              }),
            }),
          }),
        };
      }
      if (name === "answer_clusters") {
        return {
          where: () => ({
            orderBy: () => ({
              limit: () => ({
                get: vi.fn().mockResolvedValue({ empty: false, docs: clusterDocs }),
              }),
            }),
          }),
        };
      }
      if (name === "submissions") {
        return {
          where: () => ({
            where: () => ({
              limit: () => ({
                get: vi.fn().mockResolvedValue({ empty: false, docs: submissionDocs }),
              }),
            }),
          }),
        };
      }
      throw new Error(`unexpected ${name}`);
    });

    const res = await GET(
      buildRequest("http://localhost/api/yesterday?device_token=raw-dev-1"),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.self_cluster_id).toBe("c-self-cluster-id");
  });
});
