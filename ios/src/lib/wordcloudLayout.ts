// ios/src/lib/wordcloudLayout.ts
import { clusterSizeBucket, type ClusterSize } from "./clusterSizeBucket";

export interface Cluster {
  id: string;
  count: number;
  text: string;
}

export interface Placement {
  id: string;
  x: number;
  y: number;
  bucket: ClusterSize;
}

export interface LayoutOpts {
  width: number;
  height: number;
  /** Phyllotaxis step constant; tune to fit canvas */
  step?: number;
}

const PHI = Math.PI * (3 - Math.sqrt(5)); // golden angle

export function wordcloudLayout(clusters: Cluster[], opts: LayoutOpts): Placement[] {
  const { width, height } = opts;
  const step = opts.step ?? Math.min(width, height) * 0.08;
  const cx = width / 2;
  const cy = height / 2;
  const max = clusters.reduce((m, c) => Math.max(m, c.count), 0);

  // Sort by count desc — highest count first (gravitational center)
  const sorted = [...clusters].sort((a, b) => b.count - a.count);

  return sorted.map((c, i) => {
    const r = step * Math.sqrt(i);
    const theta = i * PHI;
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    return {
      id: c.id,
      x: Math.round(x),
      y: Math.round(y),
      bucket: clusterSizeBucket(c.count, max),
    };
  });
}
