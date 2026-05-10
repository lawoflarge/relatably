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

export interface UniversalLinkOpts {
  referral_code: string;
  banner_type: "todays_take" | "verdict" | "called_it";
  question_id: string;
}

// v1.0 ships without the Branch.io native module. isBranchEnabled()
// is env-gated to false so these are unreachable at runtime. Reintroduce
// in v1.0.1 alongside AdMob.

export async function initBranch(): Promise<void> {
  if (!isBranchEnabled()) return;
}

export async function createBranchUniversalLink(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _opts: UniversalLinkOpts,
): Promise<string | null> {
  if (!isBranchEnabled()) return null;
  return null;
}
