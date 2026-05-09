let cachedEnabled: boolean | undefined;

export function __resetBranchForTest(): void {
  cachedEnabled = undefined;
}

export function isBranchEnabled(): boolean {
  if (cachedEnabled === undefined) {
    cachedEnabled = (process.env.EXPO_PUBLIC_BRANCH_KEY ?? "") !== "";
  }
  return cachedEnabled;
}

export async function initBranch(): Promise<void> {
  if (!isBranchEnabled()) return;
  const branch = (await import("react-native-branch")).default;
  await branch.subscribe(() => {
    // Phase 4 leaves install-attribution params unhandled — Phase 6 will
    // deep-link them into the today flow + credit the referrer.
  });
}

export interface UniversalLinkOpts {
  referral_code: string;
  banner_type: "todays_take" | "verdict" | "called_it";
  question_id: string;
}

export async function createBranchUniversalLink(
  opts: UniversalLinkOpts,
): Promise<string | null> {
  if (!isBranchEnabled()) return null;

  const branch = (await import("react-native-branch")).default;
  const branchUniversalObject = await branch.createBranchUniversalObject(
    `relatably/share/${opts.banner_type}/${opts.question_id}`,
    {
      title: "Relatably — daily verdict",
      contentMetadata: {
        customMetadata: {
          referral_code: opts.referral_code,
          banner_type: opts.banner_type,
          question_id: opts.question_id,
        },
      },
    },
  );
  const linkProperties = { feature: "share", channel: opts.banner_type };
  const controlParams = {
    $desktop_url: "https://relatably.app",
    $ios_deepview: "default_template",
  };
  const { url } = await branchUniversalObject.generateShortUrl(linkProperties, controlParams);
  return url;
}
