// Next.js 16 calls register() once when the server boots (Node runtime only).
// Docs: node_modules/next/dist/docs/ — search "instrumentation".
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSentry } = await import("./src/lib/sentry");
    initSentry();
  }
}
