import { getKillSwitch, __resetRemoteConfigForTest } from "./remoteConfig";

// v1.0 stub: the iOS RemoteConfig client is a pass-through that always
// returns the caller-supplied fallback. The real client returns in v1.0.1
// once the RNFB iOS build chain is stable.

describe("getKillSwitch (iOS) — v1.0 stub", () => {
  beforeEach(() => {
    __resetRemoteConfigForTest();
  });

  it("returns the boolean fallback unchanged", async () => {
    await expect(getKillSwitch("drop_enabled", true)).resolves.toBe(true);
    await expect(getKillSwitch("drop_enabled", false)).resolves.toBe(false);
  });

  it("returns the number fallback unchanged", async () => {
    await expect(getKillSwitch("submit_rate_limit_per_min", 10)).resolves.toBe(10);
    await expect(getKillSwitch("submit_rate_limit_per_min", 3)).resolves.toBe(3);
  });
});
