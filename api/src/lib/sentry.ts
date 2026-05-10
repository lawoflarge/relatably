import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry(): void {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? "production",
    tracesSampleRate: 0.1,
  });
  initialized = true;
}

export function captureError(err: unknown, tags?: Record<string, string>): void {
  if (!initialized) return;
  Sentry.captureException(err, { tags });
}
