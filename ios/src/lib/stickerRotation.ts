// ios/src/lib/stickerRotation.ts
// Deterministic rotation angle per sticker id.
// Uses a simple FNV-1a-ish hash so the same id always maps to the same rotation.

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}

export interface StickerRotationOpts {
  range?: number;  // half-width in degrees; default 4 → [-4, +4]
}

export function stickerRotation(id: string, opts: StickerRotationOpts = {}): number {
  const range = opts.range ?? 4;
  const h = hashStr(id);
  const t = (h % 10001) / 10000;       // 0..1
  const angle = (t * 2 - 1) * range;   // -range..+range
  return Math.round(angle * 100) / 100;
}
