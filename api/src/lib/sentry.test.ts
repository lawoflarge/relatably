import { describe, it, expect, vi, beforeEach } from "vitest";
import { initSentry, captureError } from "./sentry";

const { sentryInit, sentryCapture } = vi.hoisted(() => ({
  sentryInit: vi.fn(),
  sentryCapture: vi.fn(),
}));

vi.mock("@sentry/node", () => ({
  init: sentryInit,
  captureException: sentryCapture,
}));

describe("api Sentry wrapper", () => {
  beforeEach(() => {
    sentryInit.mockReset();
    sentryCapture.mockReset();
    delete process.env.SENTRY_DSN;
  });

  it("does NOT init when SENTRY_DSN is unset", () => {
    initSentry();
    expect(sentryInit).not.toHaveBeenCalled();
  });

  it("inits with DSN + environment", () => {
    process.env.SENTRY_DSN = "https://abc@o0.ingest.sentry.io/2";
    process.env.SENTRY_ENVIRONMENT = "production";
    initSentry();
    expect(sentryInit).toHaveBeenCalledWith(expect.objectContaining({
      dsn: "https://abc@o0.ingest.sentry.io/2",
      environment: "production",
    }));
  });

  it("captureError forwards when initialized", () => {
    process.env.SENTRY_DSN = "https://abc@o0.ingest.sentry.io/2";
    initSentry();
    captureError(new Error("e"), { route: "/api/x" });
    expect(sentryCapture).toHaveBeenCalled();
  });
});
