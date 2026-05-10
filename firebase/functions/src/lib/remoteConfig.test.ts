import { describe, it, expect, vi, beforeEach } from "vitest";
import { getKillSwitch, __resetRemoteConfigCacheForTest } from "./remoteConfig";

const { getTemplate } = vi.hoisted(() => ({ getTemplate: vi.fn() }));

vi.mock("firebase-admin/remote-config", () => ({
  getRemoteConfig: () => ({ getTemplate }),
}));

vi.mock("./admin", () => ({
  getAdminApp: () => ({}),
}));

describe("getKillSwitch", () => {
  beforeEach(() => {
    getTemplate.mockReset();
    __resetRemoteConfigCacheForTest();
  });

  it("returns the boolean default value when flag is unset", async () => {
    getTemplate.mockResolvedValue({
      parameters: {},
    });
    const v = await getKillSwitch("drop_enabled", true);
    expect(v).toBe(true);
  });

  it("returns the boolean override when set to false", async () => {
    getTemplate.mockResolvedValue({
      parameters: { drop_enabled: { defaultValue: { value: "false" } } },
    });
    const v = await getKillSwitch("drop_enabled", true);
    expect(v).toBe(false);
  });

  it("returns the int override when flag is a number string", async () => {
    getTemplate.mockResolvedValue({
      parameters: { submit_rate_limit_per_min: { defaultValue: { value: "3" } } },
    });
    const v = await getKillSwitch("submit_rate_limit_per_min", 10);
    expect(v).toBe(3);
  });

  it("falls back to default if Remote Config call throws", async () => {
    getTemplate.mockRejectedValue(new Error("network down"));
    const v = await getKillSwitch("drop_enabled", true);
    expect(v).toBe(true);
  });

  it("caches the template (second call within TTL does not re-fetch)", async () => {
    getTemplate.mockResolvedValue({ parameters: {} });
    await getKillSwitch("drop_enabled", true);
    await getKillSwitch("drop_enabled", true);
    expect(getTemplate).toHaveBeenCalledTimes(1);
  });
});
