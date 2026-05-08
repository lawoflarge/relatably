import { describe, it, expect } from "vitest";
import { hashDeviceToken, hashIp } from "./hash";

describe("hashDeviceToken", () => {
  it("returns a 64-char sha256 hex digest", () => {
    expect(hashDeviceToken("dev-1")).toMatch(/^[a-f0-9]{64}$/);
  });
  it("is deterministic", () => {
    expect(hashDeviceToken("dev-1")).toBe(hashDeviceToken("dev-1"));
  });
  it("differs across inputs", () => {
    expect(hashDeviceToken("dev-1")).not.toBe(hashDeviceToken("dev-2"));
  });
});

describe("hashIp", () => {
  it("prefers x-forwarded-for first entry", () => {
    const a = hashIp(new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
    }));
    const b = hashIp(new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.7" },
    }));
    expect(a).toBe(b);
  });
  it("falls back to x-real-ip", () => {
    const r = hashIp(new Request("http://localhost", {
      headers: { "x-real-ip": "203.0.113.7" },
    }));
    expect(r).toMatch(/^[a-f0-9]{64}$/);
  });
  it("uses literal 'unknown' when no IP headers present", () => {
    const a = hashIp(new Request("http://localhost"));
    const b = hashIp(new Request("http://localhost"));
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
