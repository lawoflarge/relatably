import { getKillSwitch, __resetRemoteConfigForTest } from "./remoteConfig";

jest.mock("@react-native-firebase/remote-config", () => {
  const setConfigSettings = jest.fn();
  const fetchAndActivate = jest.fn();
  const getValue = jest.fn();
  const rc = jest.fn(() => ({ setConfigSettings, fetchAndActivate, getValue }));
  return { __esModule: true, default: rc };
});

import remoteConfigModule from "@react-native-firebase/remote-config";

const inst = () => remoteConfigModule() as any;

function mockValue(asString: string, source: "static" | "default" | "remote") {
  return {
    asString: () => asString,
    getSource: () => source,
  };
}

describe("getKillSwitch (iOS)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __resetRemoteConfigForTest();
    inst().fetchAndActivate.mockResolvedValue(true);
    inst().setConfigSettings.mockResolvedValue(undefined);
  });

  it("returns the boolean default when key is not set in Remote Config (source=static)", async () => {
    inst().getValue.mockReturnValue(mockValue("", "static"));
    await expect(getKillSwitch("drop_enabled", true)).resolves.toBe(true);
  });

  it("returns the boolean override when remote value is 'false'", async () => {
    inst().getValue.mockReturnValue(mockValue("false", "remote"));
    await expect(getKillSwitch("drop_enabled", true)).resolves.toBe(false);
  });

  it("returns the number override when remote value parses as a number", async () => {
    inst().getValue.mockReturnValue(mockValue("3", "remote"));
    await expect(getKillSwitch("submit_rate_limit_per_min", 10)).resolves.toBe(3);
  });

  it("returns the number fallback when remote value is not a finite number", async () => {
    inst().getValue.mockReturnValue(mockValue("not-a-number", "remote"));
    await expect(getKillSwitch("submit_rate_limit_per_min", 10)).resolves.toBe(10);
  });

  it("falls back to the caller default if fetchAndActivate throws", async () => {
    inst().fetchAndActivate.mockRejectedValueOnce(new Error("network down"));
    await expect(getKillSwitch("drop_enabled", true)).resolves.toBe(true);
  });

  it("calls setConfigSettings exactly once across multiple invocations", async () => {
    inst().getValue.mockReturnValue(mockValue("true", "remote"));
    await getKillSwitch("drop_enabled", true);
    await getKillSwitch("drop_enabled", true);
    await getKillSwitch("submit_rate_limit_per_min", 10);
    expect(inst().setConfigSettings).toHaveBeenCalledTimes(1);
    expect(inst().setConfigSettings).toHaveBeenCalledWith({
      minimumFetchIntervalMillis: 5 * 60 * 1000,
    });
  });
});
