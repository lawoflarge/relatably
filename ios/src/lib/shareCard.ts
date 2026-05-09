import { captureRef } from "react-native-view-shot";
import * as Sharing from "expo-sharing";
import type React from "react";
import { trackShare } from "@/src/lib/api";
import { isBranchEnabled, createBranchUniversalLink } from "@/src/lib/branch";
import type { BannerType, ShareTarget } from "@/src/types/api";

export interface ShareCardOpts {
  viewRef: React.RefObject<unknown>;
  banner_type: BannerType;
  question_id: string;
  share_target: ShareTarget;
}

export interface ShareCardResult {
  referral_code: string;
  shareUrl: string;
  pngUri: string;
}

export async function shareCardImage(opts: ShareCardOpts): Promise<ShareCardResult> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Sharing not available on this device");
  }

  const { referral_code } = await trackShare({
    banner_type: opts.banner_type,
    question_id: opts.question_id,
    share_target: opts.share_target,
  });

  let shareUrl = `https://relatably.app/?r=${encodeURIComponent(referral_code)}`;
  if (isBranchEnabled()) {
    const branchUrl = await createBranchUniversalLink({
      referral_code,
      banner_type: opts.banner_type,
      question_id: opts.question_id,
    });
    if (branchUrl) shareUrl = branchUrl;
  }

  const pngUri = await captureRef(opts.viewRef, {
    format: "png",
    quality: 1,
    result: "tmpfile",
  });

  await Sharing.shareAsync(pngUri, {
    mimeType: "image/png",
    dialogTitle: "Share to…",
    UTI: "public.png",
  });

  return { referral_code, shareUrl, pngUri };
}
