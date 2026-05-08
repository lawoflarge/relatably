import { requestNotificationPermission, getFcmToken } from "./messaging";

jest.mock("@react-native-firebase/messaging", () => {
  const requestPermission = jest.fn();
  const getToken = jest.fn();
  const messaging = jest.fn(() => ({ requestPermission, getToken }));
  // Surface authorization-status constants on the default export, like the SDK does.
  (messaging as any).AuthorizationStatus = {
    NOT_DETERMINED: -1,
    DENIED: 0,
    AUTHORIZED: 1,
    PROVISIONAL: 2,
  };
  return { __esModule: true, default: messaging };
});

import messagingModule from "@react-native-firebase/messaging";

describe("messaging helper", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("requestNotificationPermission returns true when status is AUTHORIZED", async () => {
    (messagingModule() as any).requestPermission.mockResolvedValueOnce(1);
    await expect(requestNotificationPermission()).resolves.toBe(true);
  });

  it("requestNotificationPermission returns true when status is PROVISIONAL", async () => {
    (messagingModule() as any).requestPermission.mockResolvedValueOnce(2);
    await expect(requestNotificationPermission()).resolves.toBe(true);
  });

  it("requestNotificationPermission returns false when status is DENIED", async () => {
    (messagingModule() as any).requestPermission.mockResolvedValueOnce(0);
    await expect(requestNotificationPermission()).resolves.toBe(false);
  });

  it("getFcmToken returns the token from the SDK", async () => {
    (messagingModule() as any).getToken.mockResolvedValueOnce("fake-token-abc");
    await expect(getFcmToken()).resolves.toBe("fake-token-abc");
  });

  it("getFcmToken returns null and swallows errors", async () => {
    (messagingModule() as any).getToken.mockRejectedValueOnce(new Error("boom"));
    await expect(getFcmToken()).resolves.toBeNull();
  });
});
