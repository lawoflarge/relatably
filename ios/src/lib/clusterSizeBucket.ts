// ios/src/lib/clusterSizeBucket.ts
// Maps a cluster's count to a font-size bucket per DESIGN.md §12.

export type ClusterSize = "xs" | "s" | "m" | "l" | "xl";

const FONT_PX: Record<ClusterSize, number> = {
  xl: 44,
  l: 30,
  m: 22,
  s: 16,
  xs: 13,
};

export function clusterSizeBucket(count: number, maxCount: number): ClusterSize {
  if (maxCount <= 0) return "xs";
  const r = count / maxCount;
  if (r >= 0.84) return "xl";
  if (r >= 0.40) return "l";
  if (r >= 0.20) return "m";
  if (r >= 0.08) return "s";
  return "xs";
}

export function clusterSizePx(bucket: ClusterSize): number {
  return FONT_PX[bucket];
}
