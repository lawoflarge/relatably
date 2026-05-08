import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Use worker threads instead of child-process forks. The forks pool
    // fails to spawn on Windows (spawn UNKNOWN / ENOENT).
    pool: "threads",
    // Run test files serially. The emulator-backed tests (prepareNextDrop,
    // triggerDrop) share one Firestore emulator project and would race on
    // docs if run in parallel.
    fileParallelism: false,
  },
});
