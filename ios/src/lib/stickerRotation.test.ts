// ios/src/lib/stickerRotation.test.ts
import { stickerRotation } from "./stickerRotation";

describe("stickerRotation", () => {
  it("returns a deterministic angle for the same id", () => {
    expect(stickerRotation("c_ai")).toBe(stickerRotation("c_ai"));
  });

  it("returns different angles for different ids", () => {
    const a = stickerRotation("c_ai");
    const b = stickerRotation("c_tiktok");
    expect(a).not.toBe(b);
  });

  it("stays inside the spec range [-4, 4] degrees", () => {
    for (const id of ["c_ai", "c_tiktok", "c_x", "c_y", "c_z", "abc", "long-id-with-stuff"]) {
      const r = stickerRotation(id);
      expect(r).toBeGreaterThanOrEqual(-4);
      expect(r).toBeLessThanOrEqual(4);
    }
  });

  it("respects a custom range when provided", () => {
    const r = stickerRotation("c_ai", { range: 1.5 });
    expect(r).toBeGreaterThanOrEqual(-1.5);
    expect(r).toBeLessThanOrEqual(1.5);
  });
});
