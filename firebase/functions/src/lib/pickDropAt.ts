const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Returns a Date uniformly random within [tomorrow 00:00 UTC, day-after 00:00 UTC).
 * Pure function; injectable `now` for testability. Caller converts to Timestamp.
 */
export function pickDropAt(now: Date): Date {
  const startOfTomorrowUTC = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  const offsetMs = Math.floor(Math.random() * ONE_DAY_MS);
  return new Date(startOfTomorrowUTC + offsetMs);
}
