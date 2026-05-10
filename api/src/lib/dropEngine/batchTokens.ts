const DEFAULT_BATCH_SIZE = 500;

/**
 * Ported verbatim from firebase/functions/src/lib/batchTokens.ts for
 * the Vercel + GitHub Actions cron architecture pivot.
 */
export function batchTokens<T>(tokens: T[], size: number = DEFAULT_BATCH_SIZE): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < tokens.length; i += size) {
    batches.push(tokens.slice(i, i + size));
  }
  return batches;
}
