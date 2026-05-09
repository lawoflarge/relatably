import { shareCardImage } from "./shareCard";
import type React from "react";

jest.mock("react-native-view-shot", () => ({
  __esModule: true,
  captureRef: jest.fn(),
  default: { captureRef: jest.fn() },
}));
jest.mock("expo-sharing", () => ({
  shareAsync: jest.fn(),
  isAvailableAsync: jest.fn().mockResolvedValue(true),
}));
jest.mock("@/src/lib/api", () => ({
  trackShare: jest.fn(),
}));
jest.mock("@/src/lib/branch", () => ({
  isBranchEnabled: jest.fn(() => false),
  createBranchUniversalLink: jest.fn(),
}));

import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import { trackShare } from "@/src/lib/api";
import { createBranchUniversalLink, isBranchEnabled } from "@/src/lib/branch";

const fakeRef: React.RefObject<unknown> = { current: { __dummy: true } };

describe("shareCardImage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls trackShare, captures the ref, opens share sheet", async () => {
    (trackShare as jest.Mock).mockResolvedValue({ referral_code: "abc.def" });
    (captureRef as jest.Mock).mockResolvedValue("file:///tmp/share.png");
    (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

    await shareCardImage({
      viewRef: fakeRef,
      banner_type: "todays_take",
      question_id: "q1",
      share_target: "system",
    });

    expect(trackShare).toHaveBeenCalledWith({
      banner_type: "todays_take",
      question_id: "q1",
      share_target: "system",
    });
    expect(captureRef).toHaveBeenCalledWith(fakeRef, expect.objectContaining({
      format: "png",
      quality: 1,
    }));
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      "file:///tmp/share.png",
      expect.any(Object),
    );
  });

  it("uses Branch deep link when enabled, falls back to relatably.app URL otherwise", async () => {
    (trackShare as jest.Mock).mockResolvedValue({ referral_code: "abc.def" });
    (captureRef as jest.Mock).mockResolvedValue("file:///tmp/share.png");
    (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);

    // Branch enabled path:
    (isBranchEnabled as jest.Mock).mockReturnValue(true);
    (createBranchUniversalLink as jest.Mock).mockResolvedValue("https://relatably.app.link/abc");
    const branchResult = await shareCardImage({
      viewRef: fakeRef,
      banner_type: "verdict",
      question_id: "q2",
      share_target: "tiktok",
    });
    expect(branchResult.shareUrl).toBe("https://relatably.app.link/abc");

    // Branch disabled path:
    (isBranchEnabled as jest.Mock).mockReturnValue(false);
    (createBranchUniversalLink as jest.Mock).mockResolvedValue(null);
    const fallbackResult = await shareCardImage({
      viewRef: fakeRef,
      banner_type: "verdict",
      question_id: "q2",
      share_target: "tiktok",
    });
    expect(fallbackResult.shareUrl).toBe("https://relatably.app/?r=abc.def");
  });

  it("throws when sharing not available", async () => {
    (trackShare as jest.Mock).mockResolvedValue({ referral_code: "x" });
    (captureRef as jest.Mock).mockResolvedValue("file:///tmp/x.png");
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValueOnce(false);

    await expect(
      shareCardImage({
        viewRef: fakeRef,
        banner_type: "called_it",
        question_id: "q3",
        share_target: "system",
      }),
    ).rejects.toThrow(/sharing not available/i);
  });
});
