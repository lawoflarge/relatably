import { requestNotificationPermission, getFcmToken } from "./messaging";

// v1.0 stub: messaging is disabled. Both functions return their negative
// answer so the boot flow gracefully skips device registration.

describe("messaging helper — v1.0 stub", () => {
  it("requestNotificationPermission returns false (notifications disabled)", async () => {
    await expect(requestNotificationPermission()).resolves.toBe(false);
  });

  it("getFcmToken returns null (FCM disabled)", async () => {
    await expect(getFcmToken()).resolves.toBeNull();
  });
});
