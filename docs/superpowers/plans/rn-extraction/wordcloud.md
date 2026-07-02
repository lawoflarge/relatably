# Wordcloud — 1:1 SwiftUI Port Spec

Source files (RN/Expo, root `/Users/levinschwab/Data/Claude/relatably/ios`):
- `src/screens/WordcloudScreen.tsx`
- `src/components/ClusterBubble.tsx` (+ `.test.tsx`)
- `src/lib/wordcloudLayout.ts` (+ `.test.ts`)
- `src/lib/clusterSizeBucket.ts` (+ `.test.ts`)
- `src/lib/stickerRotation.ts` (+ `.test.ts`)
- Supporting (behavior directly wired into the wordcloud): `src/lib/clusterModeration.ts`, `src/lib/hiddenContentStore.ts`, `src/lib/demoContent.ts`, `src/components/sticker/PaperTexture.tsx`, `src/theme/tokens.ts`

---

## 1. User-facing strings (VERBATIM)

### WordcloudScreen
| String | Where |
|---|---|
| `{totalCount.toLocaleString()} VOTES · THE WORLD IS VOTING` | header counter, top-left. `toLocaleString()` = locale-grouped number (e.g. `3,204`). Separator is `·` (U+00B7) with spaces. |
| `SHARE` | ShareButton label, top-right of header (only when share enabled) |
| `Tap any answer to hide or report it` | centered hint line under the header (only when a non-self cluster is visible) |
| `DELETE MY ANSWER` | delete button caption (idle state) |
| `DELETING…` | delete button caption while request in flight (U+2026 ellipsis) |
| `Delete my answer` | accessibilityLabel of the delete button |
| `Delete your answer?` | Alert title on delete tap |
| `Your answer will be removed from the wordcloud right away. You can't re-submit for today's drop.` | Alert message |
| `Cancel` | Alert button (style: cancel) |
| `Delete` | Alert button (style: destructive) |
| `Couldn't delete` | Alert title on delete failure; message = error's message string |

### ClusterBubble
| String | Where |
|---|---|
| `YOU` | small rotated tab on the user's own bubble |
| `{text}` | accessibilityLabel when isSelf |
| `{text}, tap to hide or report` | accessibilityLabel when NOT self |
| `Tap or long-press to hide this answer from your feed or report it` | accessibilityHint (non-self only; self has no hint) |

### Moderation sheet (clusterModeration.ts, iOS path = ActionSheetIOS)
| String | Where |
|---|---|
| `"{text}"` | sheet title — the cluster text wrapped in literal double quotes |
| `Cancel` | option index 0 (cancelButtonIndex: 0) |
| `Hide this answer` | option index 1 |
| `Report this answer` | option index 2 |
| `Block this contributor` | option index 3 (destructiveButtonIndex: 3) |
| `Couldn't hide` | Alert title if local hide throws; message = error message |
| `Thanks for reporting` | Alert title after report |
| `We removed it from your feed and will review within 24 hours.` | report Alert message |
| `Blocked` | Alert title after block |
| `We won't show this contributor's answers again.` | block Alert message |

(Android fallback, not needed for iOS port: Alert with title `"{text}"`, message `Remove from your feed, report it, or block whoever wrote it? Reports are reviewed within 24 hours.`, buttons Cancel/Hide/Report/Block-destructive.)

### Demo content (rendered as real bubbles in fallback mode)
Question (not shown on this screen but paired): id `demo-reviewer-drop`, text `what's the most overrated coffee order?`
Clusters (id / canonical_text / submission_count):
```
demo-cl-1  pumpkin spice latte  47
demo-cl-2  caramel macchiato    39
demo-cl-3  frappuccino          31
demo-cl-4  flat white           24
demo-cl-5  matcha latte         19
demo-cl-6  cold brew            15
demo-cl-7  oat milk latte       12
demo-cl-8  espresso martini      9
demo-cl-9  chai latte            7
demo-cl-10 americano             5
```

---

## 2. Numeric constants

### Design tokens (src/theme/tokens.ts — shared, quote for reference)
```ts
export const sp = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64, gutter: 22, section: 24 } as const;
export const radii = { s: 14, m: 22, l: 28, xl: 36, pill: 999 } as const;
export const shadow = {
  s: { color: palette.ink, offset: { width: 2, height: 2 }, radius: 0, opacity: 1, elevation: 2 },
  m: { color: palette.ink, offset: { width: 4, height: 4 }, radius: 0, opacity: 1, elevation: 4 },
  l: { color: palette.ink, offset: { width: 6, height: 6 }, radius: 0, opacity: 1, elevation: 6 },
} as const;
```
Note: shadows are HARD offset shadows — blur radius 0, opacity 1, ink-black. In SwiftUI: `.shadow(color: ink, radius: 0, x: 2, y: 2)` etc. (a solid offset silhouette, "sticker" look).

### WordcloudScreen
| Constant | Applies to |
|---|---|
| `cloudWidth = screenWidth - 22*2` | wordcloud canvas width (gutter 22 each side) |
| `cloudHeight = min(560, screenHeight - safeTop - safeBottom - 220)` | wordcloud canvas height cap (220 reserves header + delete row + floating tab pill) |
| `paddingTop = safeTop + 24` (sp[5]) | root container |
| `paddingBottom = safeBottom + 96` | root container (clears floating tab bar) |
| `paddingHorizontal = 22` (sp.gutter) | root container |
| header `marginBottom = 16` (sp[4]) | header row |
| counter: fontSize 11, letterSpacing 1.4 | header counter text |
| hint: fontSize 13 (typography.bodyS.size), `marginBottom 12` (sp[3]) | mod hint |
| bubble anchor offset: `left = p.x - 60`, `top = p.y - 20` | each bubble's absolute position wrapper (placement point ≈ bubble's visual anchor, NOT its center — fixed −60/−20 offset regardless of bubble size) |
| offscreen share card: `left: -10000, top: -10000, opacity: 0` | hidden render target for share-image capture |
| deleteRow `marginTop = 12` (sp[3]), centered | container under cloud |
| deleteBtn: minHeight 44, paddingH 16 (sp[4]), paddingV 8 (sp[2]), borderRadius 14 (radii.s), borderWidth 2, bg `rgba(255,255,255,0.7)`, shadow.s (2,2,0,1) | delete button |
| deleteText: fontSize 10, letterSpacing 1.4 | delete button caption |

### ClusterBubble
| Constant | Applies to |
|---|---|
| borderWidth: 2 for buckets xs/s; 3 for m/l/xl | bubble border (ink) |
| shadow: `shadow.l` (6,6) if isSelf; else `shadow.m` (4,4) for m/l/xl; `shadow.s` (2,2) for xs/s | bubble drop shadow |
| cornerRadius: 28 (radii.l) for xl/l; 22 (radii.m) for m/s/xs | bubble corner radius |
| paddingVertical: 12 (sp[3]) for xl; 8 (sp[2]) otherwise | bubble padding |
| paddingHorizontal: 16 (sp[4]) for xl; 12 (sp[3]) otherwise | bubble padding |
| rotation: `stickerRotation(id)` degrees, range [−4, +4], 2-decimal precision | whole bubble transform |
| text lineHeight = `round(fontSize * 1.2)` | headroom so BagelFatOne ascenders don't clip |
| YOU tab: `top: -12, left: -10`, borderWidth 2, borderRadius 14 (radii.s), paddingH 8 (sp[2]), paddingV 2, rotation `-12deg` | absolute-positioned tab overlapping bubble's top-left corner |
| YOU text: fontSize 10, letterSpacing 1.4 | tab caption |

### Font-size buckets (clusterSizeBucket.ts)
| Bucket | fontSize px | ratio threshold (count/maxCount) |
|---|---|---|
| xl | 44 | r ≥ 0.84 |
| l | 30 | 0.40 ≤ r < 0.84 |
| m | 22 | 0.20 ≤ r < 0.40 |
| s | 16 | 0.08 ≤ r < 0.20 |
| xs | 13 | r < 0.08, or maxCount ≤ 0 |

### Layout (wordcloudLayout.ts)
| Constant | Value |
|---|---|
| golden angle PHI | `Math.PI * (3 - Math.sqrt(5))` ≈ 2.399963229728653 rad |
| default step | `min(width, height) * 0.08` |

### PaperTexture (background)
| Constant | Value |
|---|---|
| overall SVG opacity | 0.06 |
| dot pattern tile | 12 × 12 pt |
| dot | circle cx=1, cy=1, r=1, fill ink `#1A1A1A` |
| covers | full window (absoluteFill), non-interactive |

---

## 3. Colors & fonts per element

### Palette tokens (tokens.ts)
```ts
cream: "#FFF7E8", cream2: "#FBEED1", ink: "#1A1A1A", inkSoft: "#4A4541",
pink: "#FF4FA3", lemon2: "#FFD43B", lemon: "#FFDF6B", mint: "#7AE6C3",
blue: "#7BC8F6", red: "#FF5A4F"
```

### Typography tokens used here
```ts
h3:    { size: 22, line: 28, family: "BagelFatOne" }        // bubble text FAMILY (size overridden per bucket)
bodyS: { size: 13, line: 18, family: "HankenGrotesk_700" }  // mod hint
label: { size: 11, line: 14, family: "SpaceGrotesk_600", letterSpacing: 1.1 }  // counter FAMILY (screen overrides size 11 / spacing 1.4)
micro: { size: 9,  line: 12, family: "SpaceGrotesk_700", letterSpacing: 1.3 }  // delete + YOU FAMILY (screen overrides size 10 / spacing 1.4)
```

### Per element
| Element | Font | Size | Color | Background |
|---|---|---|---|---|
| Screen background | — | — | — | `cream #FFF7E8` + PaperTexture dots overlay |
| Counter "N VOTES · …" | SpaceGrotesk_600 | 11, ls 1.4 | inkSoft `#4A4541` | — |
| Mod hint | HankenGrotesk_700 | 13 | inkSoft | — (centered) |
| Bubble text | BagelFatOne | 44/30/22/16/13 by bucket, lineHeight round(1.2×) | ink `#1A1A1A`; **cream `#FFF7E8` if isSelf** | fill below |
| Bubble fill (non-self) | — | — | — | rotation `[mint #7AE6C3, lemon #FFDF6B, blue #7BC8F6, "#FFD7E8"]` by `colorIndex % 4` (`#FFD7E8` is a literal light pink, not a token) |
| Bubble fill (self) | — | — | — | pink `#FF4FA3` |
| Bubble border + shadow | — | — | ink | hard shadow, ink |
| YOU tab | SpaceGrotesk_700 | 10, ls 1.4 | ink | lemon2 `#FFD43B`, ink border 2, radius 14 |
| Delete button text | SpaceGrotesk_700 | 10, ls 1.4 | red `#FF5A4F` | button bg `rgba(255,255,255,0.7)`, ink border 2 |

`colorIndex` = the cluster's index `i` in `visibleClusters` render order (NOT the layout-sorted order) — i.e. index in the original clusters array after hidden-filter, demo clusters appended after real ones.

---

## 4. Algorithms & state logic (verbatim code)

### 4.1 clusterSizeBucket.ts (entire)
```ts
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
```

### 4.2 stickerRotation.ts (entire) — FNV-1a hash → deterministic angle
```ts
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
```
Swift port notes: hash is 32-bit unsigned FNV-1a over **UTF-16 code units** (`charCodeAt`); JS multiplication `h * 16777619` happens in Float64 before `>>>0` truncation — for ASCII ids this matches `UInt32(truncatingIfNeeded:)` 32-bit wrapping multiply only if you replicate the exact JS semantics. For ASCII-only ids (all real ids here are ASCII), `h = (h ^ UInt32(unit)); h = h &* 16777619` in UInt32 is NOT guaranteed identical because JS's Float64 multiply loses low bits when the product exceeds 2^53. Verify against the fixture table in §8 (values below were computed by running the actual JS).

### 4.3 wordcloudLayout.ts (entire) — phyllotaxis (sunflower) layout
```ts
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
```
Notes: sort is by count DESC only; ties keep input order (JS `Array.prototype.sort` is stable). `Math.round` = round-half-up toward +∞ for .5 (Swift: `(x + 0.5).rounded(.down)` or `x.rounded(.toNearestOrAwayFromZero)` differs at negative .5 — coordinates here are positive in practice). i=0 → r=0 → exactly at center. There is NO collision avoidance — bubbles may overlap.

### 4.4 WordcloudScreen state logic (verbatim, key parts)
Props:
```ts
interface Props {
  clusters: Cluster[];              // { id, canonical_text, submission_count }
  selfClusterId: string | null;
  totalCount: number;
  questionId?: string;
  questionText?: string;
  userAnswer?: string;
  dateLabel?: string;
  selfSubmissionId?: string | null;
  onDeleted?: () => void;
}
```
State: `deleting: Bool = false`, `deleted: Bool = false`, `hiddenIds: Set<string> = []`.

On mount (once): load hidden ids async and set (with a cancelled-guard):
```ts
useEffect(() => {
  let cancelled = false;
  getHiddenClusterIds().then((ids) => {
    if (!cancelled) setHiddenIds(ids);
  });
  return () => { cancelled = true; };
}, []);
```

Visible-cluster derivation (demo fallback gate):
```ts
const visibleClusters = useMemo(() => {
  const real = clusters.filter((c) => !hiddenIds.has(c.id));
  const hasOther = real.some((c) => c.id !== selfClusterId);
  if (hasOther) return real;
  return [...real, ...DEMO_CLUSTERS.filter((c) => !hiddenIds.has(c.id))];
}, [clusters, hiddenIds, selfClusterId]);
```
→ If, after filtering hidden ids, there is no cluster other than the user's own (empty drop or backend down), append the 10 demo coffee clusters (also filtered by hiddenIds). Real clusters come first, demos appended.

Layout + lookups:
```ts
const placements = useMemo(() => {
  return wordcloudLayout(
    visibleClusters.map((c) => ({ id: c.id, text: c.canonical_text, count: c.submission_count })),
    { width: cloudWidth, height: cloudHeight },
  );
}, [visibleClusters, cloudWidth]);

const placementById = useMemo(() => new Map(placements.map((p) => [p.id, p])), [placements]);
const maxCount = useMemo(() => Math.max(0, ...visibleClusters.map((c) => c.submission_count)), [visibleClusters]);
```
(Bug-in-source worth knowing: the placements memo omits `cloudHeight` from deps — irrelevant in SwiftUI, just recompute on any change.)

Hide handler (local state add):
```ts
const handleHide = (id: string) => {
  setHiddenIds((prev) => { const next = new Set(prev); next.add(id); return next; });
};
```

Share gate: `const shareEnabled = !!(questionId && questionText && userAnswer && dateLabel);` — all four must be non-empty. Controls: SHARE button in header AND the offscreen ShareCardTodaysTake render target.

Delete flow (verbatim behavior): confirmation Alert → on Delete: `deleting=true`; `getDeviceToken()`; `deleteOwnSubmission(selfSubmissionId, deviceToken)`; on success `deleted=true` + `onDeleted?.()`; on error Alert `"Couldn't delete"` with error message; finally `deleting=false`. Delete row renders only when `selfSubmissionId != nil && !deleted`. Button is disabled while `deleting`.

### 4.5 ClusterBubble derived styling (verbatim)
```ts
const FILL_ROTATION = [palette.mint, palette.lemon, palette.blue, "#FFD7E8"] as const;

const bucket = clusterSizeBucket(count, maxCount);
const fontSize = clusterSizePx(bucket);
const angle = stickerRotation(id);

const isLargeBucket = bucket === "xl" || bucket === "l" || bucket === "m";
const borderWidth = bucket === "xs" || bucket === "s" ? 2 : 3;
const shadowSpec = isSelf ? shadow.l : (isLargeBucket ? shadow.m : shadow.s);
const radius = bucket === "xl" || bucket === "l" ? radii.l : radii.m;
const fill = isSelf ? palette.pink : FILL_ROTATION[colorIndex % FILL_ROTATION.length];
const fg = isSelf ? palette.cream : palette.ink;

const openModeration = () => {
  if (isSelf) return;
  openClusterModerationSheet(id, text, onHide);
};
```
Both tap AND long-press call `openModeration`. Self bubble: no-op on tap (it has the DELETE MY ANSWER affordance instead). Note: `isSelf` overrides the shadow even for small buckets (self always gets shadow.l 6,6).

### 4.6 Moderation actions (clusterModeration.ts) — order of operations matters
- **Hide** (index 1): `await hideCluster({id,text})` (local persist) → `onHidden?.(id,text)`; on throw: Alert `Couldn't hide`.
- **Report** (index 2): `await hideCluster` → `onHidden?.()` → best-effort `reportContent({ target_type: "cluster", target_id: id, device_token })` (errors swallowed) → Alert `Thanks for reporting` / `We removed it from your feed and will review within 24 hours.` — the success alert shows even if server report failed.
- **Block** (index 3, destructive): `await hideCluster` → `await addBlockedUser({ user_id: "contributor:" + id, handle: text })` → `onHidden?.()` → best-effort `reportContent({ target_type: "cluster", target_id: id, reason: "blocked contributor", device_token })` → Alert `Blocked` / `We won't show this contributor's answers again.`
- Local removal ALWAYS happens first (offline-safe, works on demo content and anonymous users).

---

## 5. Persistence keys & stored JSON shapes

AsyncStorage (SwiftUI equivalent: UserDefaults or a file store — NOT Keychain; source comments say Keychain's ~2KB/value limit can overflow for power users).

| Key | Shape |
|---|---|
| `ugc_hidden_clusters_v1` | JSON array of `{ "id": string, "text": string, "hidden_at": number }` — `hidden_at` = epoch **milliseconds** (`Date.now()`). Newest entries `unshift`ed to FRONT. Duplicate id → no-op. |
| `ugc_blocked_users_v1` | JSON array of `{ "user_id": string, "handle": string \| null, "blocked_at": number }` — same conventions (ms epoch, newest-first, dedupe by user_id). Wordcloud blocks store `user_id = "contributor:<clusterId>"`, `handle = <cluster text>`. |

Read behavior: missing key → `[]`; parse error or non-array → `[]` (never crash). `unhideCluster(id)` / `removeBlockedUser(user_id)` filter-rewrite (used by the ME tab, keep API surface).

---

## 6. Component tree / layout structure

```
Root View (flex:1, bg cream #FFF7E8, paddingH 22, paddingTop safeTop+24, paddingBottom safeBottom+96)
├─ PaperTexture (absoluteFill, non-interactive: full-screen 12×12 dot grid, r=1 ink dots, whole layer opacity 0.06)
├─ Header row (HStack, space-between, center-aligned, marginBottom 16)
│  ├─ Counter Text "N VOTES · THE WORLD IS VOTING" (SpaceGrotesk_600 11 / ls 1.4 / inkSoft)
│  └─ ShareButton "SHARE" (only if shareEnabled; captures the offscreen card ref; analytics props: banner_type="todays_take", share_target="system", question_id)
├─ Mod hint Text (only if any visible cluster ≠ self) — centered, marginBottom 12
├─ Cloud View (width cloudWidth, height cloudHeight, self-centered, position relative)
│  └─ for each visibleClusters[i] with placement p:
│     View (absolute, left = p.x − 60, top = p.y − 20)
│     └─ ClusterBubble(id, text, count, maxCount, isSelf: id==selfClusterId, colorIndex: i, onHide: handleHide)
│        ├─ Pressable "sticker" (fill/border/radius/shadow/padding per §2–3, rotated by stickerRotation(id) deg, alignSelf flex-start → hugs content)
│        │  └─ Text (BagelFatOne, bucket px, lineHeight round(1.2×px))
│        └─ if isSelf: YOU tab (absolute top −12 / left −10, lemon2 bg, ink border 2, radius 14, paddingH 8 / V 2, rotated −12°)
│           └─ Text "YOU" (SpaceGrotesk_700 10 / ls 1.4 / ink)
├─ Offscreen share-card container (only if shareEnabled; absolute at −10000/−10000, opacity 0, pointerEvents none)
│  └─ ShareCardTodaysTake(questionText, userAnswer, date: dateLabel)   ← render target for image capture
└─ Delete row (only if selfSubmissionId != nil && !deleted; centered, marginTop 12)
   └─ Pressable delete button (minHeight 44, paddingH 16 / V 8, radius 14, ink border 2, bg rgba(255,255,255,0.7), shadow.s, disabled while deleting)
      └─ Text "DELETE MY ANSWER" / "DELETING…" (SpaceGrotesk_700 10 / ls 1.4 / red)
```

Bubbles are NOT clipped to the cloud frame (RN default: children can overflow the relative container; no `overflow: hidden` set). Z-order = visibleClusters array order (later items on top).

---

## 7. Surprising behaviors / edge cases

1. **Demo fallback gate (Guideline 1.2)**: demo coffee clusters appear whenever the only remaining visible real cluster is the user's own (or none) — including when the user hides all others one by one. Hidden demo ids stay hidden too. This was the fix for repeated App Review 1.2 rejections; do not "optimize" it away.
2. **Mod hint visibility**: shown when `visibleClusters.some(c => c.id !== selfClusterId)` — given the demo fallback this is effectively always true unless every demo cluster has been hidden AND only the self cluster remains.
3. **Placement anchor**: bubble wrapper is placed at `(p.x − 60, p.y − 20)` — a fixed offset independent of the actual rendered bubble size, so the placement point is roughly the bubble's center only for medium bubbles. Reproduce EXACTLY for visual parity (bubbles hug their text; no fixed widths).
4. **No collision handling**: phyllotaxis positions can overlap for long texts / small canvases. That's the shipped look.
5. **Moderation success alerts are optimistic**: "Thanks for reporting" / "Blocked" show even if the server call failed (errors swallowed). Local hide always precedes network.
6. **Self bubble tap is inert**: no moderation sheet for own answer; deletion is server-side via the button below the cloud.
7. **Delete is one-way**: after success the row disappears (`deleted=true`) and copy warns "You can't re-submit for today's drop."
8. **Hidden ids load async after first paint** — screen briefly renders with nothing hidden, then re-filters when storage resolves. A SwiftUI port can load before first render; only preserve the "always filter by stored set" semantics.
9. **`toLocaleString()`** on the counter → thousands separators per device locale.
10. **Bucket comment vs code mismatch**: clusterSizeBucket test title says "ratio ≥ 0.85" but the code threshold is **0.84** — code wins (test vector 2723/3204 = 0.8499 must be `xl`).
11. **Blocking is a local fiction**: "Block this contributor" hides one cluster + stores `contributor:<clusterId>` locally + best-effort report; there is no real per-user server block (answers are anonymous aggregates). The blocked list must be visible/reversible under the ME tab.
12. **Shadows have zero blur**: hard-edged ink offset "sticker" shadows. On iOS use shadowRadius 0 (or a background offset shape), not default blurred shadows.
13. **lineHeight headroom**: BagelFatOne clips ascenders when line height ≤ font size; every bubble uses `lineHeight = round(fontSize * 1.2)`. Check the font's real metrics in UIKit/SwiftUI — you may not need the workaround, but keep visual line box comparable.
14. **`Math.max(0, ...[])`**: with zero visible clusters `maxCount = 0` (JS `Math.max()` of nothing is −Infinity, floored to 0 by the leading 0). Bucket then returns xs (guard `maxCount <= 0`).

---

## 8. Test vectors (XCTest fixtures)

### clusterSizeBucket(count, maxCount) → bucket
| count | maxCount | expected |
|---|---|---|
| 3204 | 3204 | `xl` (r=1.0) |
| 2723 | 3204 | `xl` (r≈0.8499 ≥ 0.84) |
| 1892 | 3204 | `l` (r≈0.590) |
| 987 | 3204 | `m` (r≈0.308) |
| 389 | 3204 | `s` (r≈0.121) |
| 18 | 3204 | `xs` (r≈0.0056) |
| 0 | 0 | `xs` (degenerate guard) |

clusterSizePx: xl→44, l→30, m→22, s→16, xs→13.

### stickerRotation(id) → degrees (computed by executing the actual JS; verify Swift hash against the hash column)
| id | FNV-1a hash (u32) | rotation (range 4) |
|---|---|---|
| `c_ai` | 1673859815 | **−2.04** |
| `c_tiktok` | 277938010 | **−3.82** |
| `c_x` | 35367296 | **−0.99** |
| `c_y` | 18589676 | **2.25** |
| `c_z` | 68922532 | **0.51** |
| `abc` | 440920332 | **1.0** |
| `long-id-with-stuff` | 3590953712 | **−0.28** |
| `demo-cl-1` | 2263043099 | **1.45** |
| `demo-cl-2` | 2279820718 | **−1.79** |
| `demo-cl-3` | 2296598337 | **2.96** |
| `c_ai`, range 1.5 | 1673859815 | **−0.77** |

Property tests from source: same id → same angle; different ids (`c_ai` vs `c_tiktok`) → different angles; always within [−range, +range].

### wordcloudLayout — fixture `[{c_ai,3204},{c_tiktok,1892},{c_x,100}]`, canvas 350×600 (step = 350×0.08 = 28)
Exact outputs (computed by executing the JS):
| id | x | y | bucket |
|---|---|---|---|
| `c_ai` (i=0) | 175 | 300 | `xl` |
| `c_tiktok` (i=1) | 154 | 319 | `l` |
| `c_x` (i=2) | 178 | 261 | `m` (100/3204≈0.031→ actually `xs`; see note) |

Note: bucket for `c_x`: 100/3204 ≈ 0.0312 < 0.08 → **`xs`** (table row corrected; only x/y were computed, bucket follows §4.1). Source test asserts: 3 placements, ids preserved; `c_ai` within |x−175|<60 and |y−300|<120 of center; `c_ai.bucket == "xl"`; output fully deterministic across runs.

### ClusterBubble component tests (behavioral)
- Renders cluster text.
- `isSelf == true` → renders a `YOU` tab.
- Same id → identical render (rotation deterministic).

---

## 9. External dependencies referenced (out of scope here, extracted elsewhere)

- `ShareButton` (props used: viewRef, banner_type `"todays_take"`, question_id, share_target `"system"`, label `"SHARE"`)
- `ShareCardTodaysTake(questionText, userAnswer, date)` — rendered offscreen as capture target
- `deleteOwnSubmission(submissionId, deviceToken)` and `reportContent({ target_type, target_id, reason?, device_token })` — API layer (`src/lib/api.ts`)
- `getDeviceToken()` (`src/lib/deviceId.ts`)
- Fonts: BagelFatOne, HankenGrotesk (700), SpaceGrotesk (600/700)
