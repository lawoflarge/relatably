// ios/src/lib/wordcloudLayout.test.ts
import { wordcloudLayout } from "./wordcloudLayout";

const FIXTURE = [
  { id: "c_ai", count: 3204, text: "AI" },
  { id: "c_tiktok", count: 1892, text: "tiktok" },
  { id: "c_x", count: 100, text: "x" },
];

describe("wordcloudLayout", () => {
  it("returns one placement per input cluster", () => {
    const out = wordcloudLayout(FIXTURE, { width: 350, height: 600 });
    expect(out).toHaveLength(3);
    expect(out.map((p) => p.id).sort()).toEqual(["c_ai", "c_tiktok", "c_x"].sort());
  });

  it("places the highest-count cluster near the canvas center", () => {
    const out = wordcloudLayout(FIXTURE, { width: 350, height: 600 });
    const top = out.find((p) => p.id === "c_ai")!;
    expect(Math.abs(top.x - 175)).toBeLessThan(60);
    expect(Math.abs(top.y - 300)).toBeLessThan(120);
  });

  it("emits cluster bucket alongside placement", () => {
    const out = wordcloudLayout(FIXTURE, { width: 350, height: 600 });
    const top = out.find((p) => p.id === "c_ai")!;
    expect(top.bucket).toBe("xl");
  });

  it("is deterministic across runs", () => {
    const a = wordcloudLayout(FIXTURE, { width: 350, height: 600 });
    const b = wordcloudLayout(FIXTURE, { width: 350, height: 600 });
    expect(a).toEqual(b);
  });
});
