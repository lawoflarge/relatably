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
  it("prefers x-vercel-forwarded-for above all other headers", () => {
    const a = hashIp(new Request("http://localhost", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.7",
        "x-real-ip": "10.0.0.1",
        "x-forwarded-for": "9.9.9.9, 10.0.0.1",
      },
    }));
    const b = hashIp(new Request("http://localhost", {
      headers: { "x-vercel-forwarded-for": "203.0.113.7" },
    }));
    expect(a).toBe(b);
  });
  it("prefers x-real-ip over x-forwarded-for", () => {
    const a = hashIp(new Request("http://localhost", {
      headers: { "x-real-ip": "203.0.113.7", "x-forwarded-for": "9.9.9.9" },
    }));
    const b = hashIp(new Request("http://localhost", {
      headers: { "x-real-ip": "203.0.113.7" },
    }));
    expect(a).toBe(b);
  });
  it("uses the RIGHTMOST x-forwarded-for entry (platform-trusted), not the spoofable leftmost", () => {
    // The leftmost entry is client-controlled; only the rightmost is appended
    // by the trusted proxy. A spoofed leftmost must not change the hash.
    const spoofed = hashIp(new Request("http://localhost", {
      headers: { "x-forwarded-for": "1.1.1.1, 203.0.113.7" },
    }));
    const trusted = hashIp(new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.7" },
    }));
    expect(spoofed).toBe(trusted);
  });
  it("does NOT use the leftmost x-forwarded-for entry", () => {
    const leftmost = hashIp(new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.7" },
    }));
    const withSpoofedLeftmost = hashIp(new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.7, 8.8.8.8" },
    }));
    // rightmost differs (8.8.8.8 vs 203.0.113.7) → hashes must differ
    expect(withSpoofedLeftmost).not.toBe(leftmost);
  });
  it("uses literal 'unknown' when no IP headers present", () => {
    const a = hashIp(new Request("http://localhost"));
    const b = hashIp(new Request("http://localhost"));
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});
