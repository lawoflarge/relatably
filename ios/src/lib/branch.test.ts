import { isBranchEnabled, initBranch, createBranchUniversalLink, __resetBranchForTest } from "./branch";

describe("branch adapter", () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_BRANCH_KEY;
    __resetBranchForTest();
  });

  it("isBranchEnabled is false by default", () => {
    expect(isBranchEnabled()).toBe(false);
  });

  it("isBranchEnabled is true when key set", () => {
    process.env.EXPO_PUBLIC_BRANCH_KEY = "key_live_abc";
    __resetBranchForTest();
    expect(isBranchEnabled()).toBe(true);
  });

  it("initBranch is a no-op when disabled (no throw)", async () => {
    await expect(initBranch()).resolves.toBeUndefined();
  });

  it("createBranchUniversalLink returns null when disabled", async () => {
    const r = await createBranchUniversalLink({
      referral_code: "abc.def",
      banner_type: "todays_take",
      question_id: "q1",
    });
    expect(r).toBeNull();
  });
});
