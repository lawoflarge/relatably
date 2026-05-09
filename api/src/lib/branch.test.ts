import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { signReferralCode, verifyReferralCode, __resetBranchForTest } from "./branch";

describe("branch referral codes", () => {
  beforeEach(() => __resetBranchForTest());
  afterEach(() => {
    delete process.env.BRANCH_REFERRAL_SECRET;
    __resetBranchForTest();
  });

  it("signs a payload and verifies it round-trips", () => {
    process.env.BRANCH_REFERRAL_SECRET = "test-secret-32-chars-long-enough";
    __resetBranchForTest();
    const code = signReferralCode({
      user_id: "u-1",
      question_id: "q-1",
      banner_type: "todays_take",
      ts: 1700000000000,
    });
    expect(code).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

    const decoded = verifyReferralCode(code);
    expect(decoded).toEqual({
      user_id: "u-1",
      question_id: "q-1",
      banner_type: "todays_take",
      ts: 1700000000000,
    });
  });

  it("returns null when signature is tampered with", () => {
    process.env.BRANCH_REFERRAL_SECRET = "test-secret-32-chars-long-enough";
    __resetBranchForTest();
    const code = signReferralCode({
      user_id: "u-1",
      question_id: "q-1",
      banner_type: "todays_take",
      ts: 1,
    });
    const [payload] = code.split(".");
    expect(verifyReferralCode(`${payload}.tampered_sig`)).toBeNull();
  });

  it("returns null on malformed code", () => {
    process.env.BRANCH_REFERRAL_SECRET = "test-secret-32-chars-long-enough";
    __resetBranchForTest();
    expect(verifyReferralCode("not-a-code")).toBeNull();
    expect(verifyReferralCode("")).toBeNull();
  });

  it("uses dev fallback when BRANCH_REFERRAL_SECRET unset", () => {
    delete process.env.BRANCH_REFERRAL_SECRET;
    __resetBranchForTest();
    const code = signReferralCode({
      user_id: "u-1",
      question_id: "q-1",
      banner_type: "todays_take",
      ts: 1,
    });
    expect(code).toBe("dev-referral.dev");
    expect(verifyReferralCode("dev-referral.dev")).toEqual({
      user_id: null,
      question_id: null,
      banner_type: null,
      ts: 0,
      dev: true,
    });
  });

  it("treats null user_id as anonymous referral (still signed)", () => {
    process.env.BRANCH_REFERRAL_SECRET = "test-secret-32-chars-long-enough";
    __resetBranchForTest();
    const code = signReferralCode({
      user_id: null,
      question_id: "q-1",
      banner_type: "verdict",
      ts: 42,
    });
    const decoded = verifyReferralCode(code);
    expect(decoded).toMatchObject({ user_id: null, banner_type: "verdict" });
  });
});
