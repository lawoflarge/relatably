// Banner placements are intentionally disabled. Relatably monetizes with a
// single post-reveal interstitial video (see src/lib/ads.ts); it ships no
// banner ads, so this renders nothing rather than a fake "SPONSORED" card.
interface Props { slot: "leaderboard_banner" | "archive_banner" | "interstitial" }
export function BannerAdSlot(_props: Props) {
  return null;
}
