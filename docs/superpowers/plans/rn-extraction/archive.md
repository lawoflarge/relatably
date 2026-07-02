# Relatably — Archive feature extraction (ArchiveScreen, ArchiveDetailScreen, routing)

Source root: `/Users/levinschwab/Data/Claude/relatably/ios`
Files covered: `src/screens/ArchiveScreen.tsx`, `src/screens/ArchiveDetailScreen.tsx`, `app/(tabs)/archive.tsx` (tab container), `app/(tabs)/archive/[id].tsx` (detail route), plus direct dependencies: `src/components/ArchiveTileThumbnail.tsx`, `src/lib/hiddenContentStore.ts`, `src/lib/clusterModeration.ts`, `src/lib/demoContent.ts` (archive parts), `src/lib/api.ts` (archive endpoints), `src/theme/tokens.ts`, `src/components/sticker/PaperTexture.tsx`, `src/components/BannerAdSlot.tsx`, `src/components/ShareButton.tsx`, `src/lib/shareCard.ts` (behavioral contract only), `app/(tabs)/_layout.tsx`. Test fixtures from `ArchiveScreen.test.tsx`, `ArchiveDetailScreen.test.tsx`, `ArchiveTileThumbnail.test.tsx`.

---

## 0. Design tokens referenced (from `src/theme/tokens.ts`)

```ts
export const palette = {
  cream: "#FFF7E8",
  cream2: "#FBEED1",
  ink: "#1A1A1A",
  inkSoft: "#4A4541",
  pink: "#FF4FA3",
  lemon2: "#FFD43B",
  lemon: "#FFDF6B",
  mint: "#7AE6C3",
  blue: "#7BC8F6",
  red: "#FF5A4F",
} as const;

export const typography = {
  hero:   { size: 52, line: 62, family: "BagelFatOne" },
  h1:     { size: 40, line: 48, family: "BagelFatOne" },
  h2:     { size: 36, line: 44, family: "BagelFatOne" },
  h3:     { size: 22, line: 28, family: "BagelFatOne" },
  bodyL:  { size: 17, line: 24, family: "HankenGrotesk_700" },
  body:   { size: 15, line: 20, family: "HankenGrotesk_700" },
  bodyS:  { size: 13, line: 18, family: "HankenGrotesk_700" },
  label:  { size: 11, line: 14, family: "SpaceGrotesk_600", letterSpacing: 1.1 },
  micro:  { size: 9,  line: 12, family: "SpaceGrotesk_700", letterSpacing: 1.3 },
} as const;

export const sp = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64, gutter: 22, section: 24 } as const;
export const radii = { s: 14, m: 22, l: 28, xl: 36, pill: 999 } as const;

export const shadow = {
  s: { color: palette.ink, offset: { width: 2, height: 2 }, radius: 0, opacity: 1, elevation: 2 },
  m: { color: palette.ink, offset: { width: 4, height: 4 }, radius: 0, opacity: 1, elevation: 4 },
  l: { color: palette.ink, offset: { width: 6, height: 6 }, radius: 0, opacity: 1, elevation: 6 },
} as const;
```

Shadows are hard-edged "sticker" shadows: blur radius 0, opacity 1, solid ink color, offset (2,2)/(4,4)/(6,6). Token comment: BagelFatOne needs lineHeight headroom ~1.2x size on iOS or ascenders clip.

---

## 1. Data types + API contract

```ts
// src/types/api.ts
export interface ArchiveTile {
  question_id: string;
  question_text: string;
  verdict_text: string;
  top_clusters: string[];   // plain strings, NOT cluster objects
  created_at: string;       // ISO date string
}
export interface ArchivePage {
  tiles: ArchiveTile[];
  next_cursor: string | null;
}
export interface ArchiveDetailCluster {
  id: string;
  canonical_text: string;
  submission_count: number;
  final_rank: number;
  final_pct_of_total: number;   // fraction 0..1
}
export interface ArchiveDetail {
  id: string;
  text: string;              // the question text
  created_at: string;        // ISO
  top_clusters: ArchiveDetailCluster[];
}
```

```ts
// src/lib/api.ts
const BASE = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

export async function fetchArchive(cursor?: string): Promise<ArchivePage> {
  const url = cursor
    ? `${BASE}/api/archive?cursor=${encodeURIComponent(cursor)}`
    : `${BASE}/api/archive`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetchArchive failed: ${res.status}`);
  return (await res.json()) as ArchivePage;
}

export async function fetchArchiveDetail(questionId: string): Promise<ArchiveDetail> {
  const res = await fetch(`${BASE}/api/archive/${encodeURIComponent(questionId)}`);
  if (!res.ok) throw new Error(`fetchArchiveDetail failed: ${res.status}`);
  return (await res.json()) as ArchiveDetail;
}

export interface ReportPayload {
  target_type: "cluster" | "submission" | "user";
  target_id: string;
  reason?: string;
  device_token?: string;
}
export async function reportContent(payload: ReportPayload): Promise<void> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/report`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`report failed: ${res.status}`);
}
```

No auth header on the two archive GETs. `reportContent` sends auth headers + JSON body.

---

## 2. Routing (expo-router)

`app/(tabs)/_layout.tsx` — custom tab bar, no native headers anywhere:

```tsx
<Tabs
  screenOptions={{ headerShown: false }}
  tabBar={(props) => <StickerTabBar {...props} />}
>
  <Tabs.Screen name="index" options={{ title: "Today" }} />
  <Tabs.Screen name="friends" options={{ title: "Friends" }} />
  <Tabs.Screen name="leaderboard" options={{ title: "Board" }} />
  <Tabs.Screen name="archive" options={{ title: "Archive" }} />
  <Tabs.Screen name="settings" options={{ title: "Settings" }} />
  {/* archive/[id] is reached via router.push from ArchiveTab — hide from tab bar */}
  <Tabs.Screen name="archive/[id]" options={{ href: null }} />
</Tabs>
```

- Tab title for this feature: **"Archive"**.
- Detail route `archive/[id]` is a hidden tab-level screen (`href: null`), i.e. it replaces the tab content while the tab bar stays visible; no navigation header, **no back button is rendered by these screens** (the tab bar is the only nav affordance; there is no toolbar back chrome in the detail screen itself — SwiftUI port should confirm intended back behavior).
- Navigation to detail: `router.push(`/(tabs)/archive/${id}`)` where `id = tile.question_id`.

`app/(tabs)/archive/[id].tsx` (entire file):

```tsx
import { useLocalSearchParams } from "expo-router";
import { ArchiveDetailScreen } from "@/src/screens/ArchiveDetailScreen";

export default function ArchiveDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ArchiveDetailScreen questionId={id ?? ""} />;
}
```

Param fallback: missing `id` → `""` (fetch of `/api/archive/` will fail → error state).

---

## 3. Archive tab container — `app/(tabs)/archive.tsx`

State: `tiles: ArchiveTile[]` (init `[]`), `nextCursor: string | null` (init `null`), `loading: boolean` (init `false`), `longPressedTile: ArchiveTile | null` (init `null`), `shareRef` (view ref for capture), `rafIdRef` (pending animation-frame id).

Initial load effect (on mount, cancellable):

```tsx
useEffect(() => {
  let cancelled = false;
  setLoading(true);
  fetchArchive()
    .then((page) => {
      if (cancelled) return;
      setTiles(page.tiles);
      setNextCursor(page.next_cursor);
    })
    .catch(() => {
      if (!cancelled) Alert.alert("couldn't load archive");
    })
    .finally(() => {
      if (!cancelled) setLoading(false);
    });
  return () => { cancelled = true; };
}, []);
```

- Failure alert (title only, no message/buttons customized): **"couldn't load archive"**.
- NOTE: while `loading===true` and `tiles===[]`, the UI shows the *empty state* (there is no spinner on the archive tab; `loading` only gates pagination).

Pagination:

```tsx
const onLoadMore = useCallback(async () => {
  if (!nextCursor || loading) return;
  setLoading(true);
  try {
    const page = await fetchArchive(nextCursor);
    setTiles((prev) => [...prev, ...page.tiles]);
    setNextCursor(page.next_cursor);
  } catch {
    // best-effort; user can scroll back up and try again
  } finally {
    setLoading(false);
  }
}, [nextCursor, loading]);
```

Pagination errors are silent (no alert). Append-only; cursor replaced each page; `next_cursor === null` ends pagination.

Tile press → `router.push(`/(tabs)/archive/${id}`)`.

Long-press → share flow (offscreen render then capture):

```tsx
const onTileLongPress = useCallback((tile: ArchiveTile) => {
  setLongPressedTile(tile);
  // Defer to next frame so React paints the offscreen ShareCardVerdict
  // before captureRef runs. RAF is more robust than a magic setTimeout(50).
  rafIdRef.current = requestAnimationFrame(() => {
    rafIdRef.current = null;
    if (!shareRef.current) return;
    shareCardImage({
      viewRef: shareRef,
      banner_type: "verdict",
      question_id: tile.question_id,
      share_target: "system",
    })
      .catch(() => { /* best-effort; user can try again */ })
      .finally(() => {
        // free the offscreen ShareCardVerdict so it doesn't sit mounted forever
        setLongPressedTile(null);
      });
  });
}, []);
```

Unmount cleanup: `if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);`

Offscreen share card (mounted only while `longPressedTile != null`):

```tsx
{longPressedTile && (
  <View ref={shareRef} collapsable={false} pointerEvents="none"
        style={{ position: "absolute", left: -10000, top: -10000, opacity: 0 }}>
    <ShareCardVerdict
      verdictText={longPressedTile.verdict_text}
      topClusters={longPressedTile.top_clusters.map((text, i) => ({ canonical_text: text, final_rank: i + 1 }))}
      userRank={null}
      percentile={null}
      date={new Date(longPressedTile.created_at).toLocaleDateString()}
    />
  </View>
)}
```

- `top_clusters` (string array) is mapped to `{canonical_text, final_rank: i+1}` — ranks are positional 1-based.
- `date` = device-locale short date of `created_at`.

Share pipeline contract (`src/lib/shareCard.ts` — for behavior parity):
1. `Sharing.isAvailableAsync()` else throw `"Sharing not available on this device"`.
2. `trackShare({banner_type, question_id, share_target})` server call FIRST → returns `referral_code` (network failure here aborts the whole share).
3. Share URL: `https://relatably.app/?r=${encodeURIComponent(referral_code)}` (replaced by Branch link if Branch enabled).
4. `captureRef(viewRef, { format: "png", quality: 1, result: "tmpfile" })`.
5. `Sharing.shareAsync(pngUri, { mimeType: "image/png", dialogTitle: "Share to…", UTI: "public.png" })` — system share sheet with the PNG (the URL is not attached to the system share here; it's returned).

---

## 4. ArchiveScreen (list) — `src/screens/ArchiveScreen.tsx`

Pure presentational. Props: `tiles`, `nextCursor`, `onLoadMore`, `onTilePress(questionId)`, `onTileLongPress(tile)`.

### 4.1 Ad interleaving algorithm (verbatim)

```ts
type Row = { kind: "tile"; tile: ArchiveTile; index: number } | { kind: "ad"; key: string };

function interleaveAds(tiles: ArchiveTile[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < tiles.length; i++) {
    rows.push({ kind: "tile", tile: tiles[i], index: i });
    if ((i + 1) % 8 === 0) rows.push({ kind: "ad", key: `archive-banner-${i + 1}` });
  }
  return rows;
}
```

Ad row after every 8th tile (after tiles 8, 16, 24, …). BUT `BannerAdSlot` **renders `null`** in production:

```tsx
// src/components/BannerAdSlot.tsx (entire logic)
// Banner placements are intentionally disabled. Relatably monetizes with a
// single post-reveal interstitial video (see src/lib/ads.ts); it ships no
// banner ads, so this renders nothing rather than a fake "SPONSORED" card.
interface Props { slot: "leaderboard_banner" | "archive_banner" | "interstitial" }
export function BannerAdSlot(_props: Props) { return null; }
```

So the shipped app has NO visible banner; keep the structure only if 1:1 fidelity to code is desired, otherwise omit. (Tests assert a `banner-ad-slot-disabled` testID with 2 occurrences for 17 tiles — that testID comes from the test-time ads mock path, not this shipped component.)

### 4.2 Empty state

Rendered when `tiles.length === 0` (including during initial load):

- Full-screen container: `flex:1`, background `palette.cream` (#FFF7E8), items centered both axes, `paddingHorizontal: 22` (sp.gutter).
- `PaperTexture` behind (see §8).
- Card rotated **-1.5deg**:
  - background `#FFFFFF`, border `palette.ink` width **3**, cornerRadius **22** (radii.m)
  - padding H **24** / V **24** (sp[5]), internal gap **12** (sp[3]), `alignItems:center`, `maxWidth: 360`
  - shadow m: color #1A1A1A, offset (4,4), blur 0, opacity 1.
- Heading text (exact): **"fresh archive"** — font BagelFatOne 36 / lineHeight 44 (typography.h2), color ink, centered.
- Body text (exact): **"once you answer your first drop, yesterday's verdict shows up here. come back tomorrow."** — HankenGrotesk_700 17 / 24 (bodyL), color inkSoft #4A4541, centered.

### 4.3 List

- Outer: `flex:1`, background cream, `PaperTexture` layered behind the FlatList.
- FlatList over `interleaveAds(tiles)`:
  - `keyExtractor`: ad → `archive-banner-${n}`; tile → `tile.question_id`
  - `onEndReached={() => { if (nextCursor) onLoadMore(); }}`
  - `onEndReachedThreshold={0.5}` (trigger when scrolled within half a viewport of the end)
  - `initialNumToRender={30}`
  - `contentContainerStyle={{ paddingTop: insets.top + 24, paddingHorizontal: 22, paddingBottom: 120, gap: 16 }}` — safe-area top + sp[5]=24; bottom padding 120 to clear the floating sticker tab bar; 16pt vertical gap between rows.

### 4.4 Tile row

Row render (verbatim core):

```tsx
const rot = item.index % 2 === 0 ? -1.5 : 1.5;
return (
  <Pressable onPress={() => onTilePress(t.question_id)} onLongPress={() => onTileLongPress(t)}
             style={[styles.tile, { transform: [{ rotate: `${rot}deg` }] }]}>
    <View style={styles.dateTab}><Text style={styles.dateText}>{(t.date_label ?? "—").toUpperCase()}</Text></View>
    <Text style={styles.question} numberOfLines={3}>{t.question_text}</Text>
    <Text style={styles.verdict} numberOfLines={1}>{t.verdict_text}</Text>
    <View style={styles.thumb}><ArchiveTileThumbnail texts={t.top_clusters} /></View>
  </Pressable>
);
```

- Rotation alternates by tile index (NOT row index in the interleaved array): even tile index → **-1.5°**, odd → **+1.5°**.
- Tile card: `position:relative`, background `#FFFFFF`, border ink width **2**, radius **22**, `paddingTop: 34` (sp[6]+2), `paddingHorizontal: 12` (sp[3]), `paddingBottom: 12`, `minHeight: 130`, shadow s (ink, offset (2,2), blur 0, opacity 1).
- Date tab (sticker label overlapping top edge): `position:absolute, top: -10, left: 10`, background ink, `paddingHorizontal: 8` (sp[2]), `paddingVertical: 4`, `borderRadius: 6`.
  - Text: family SpaceGrotesk_700 (typography.micro.family) but **fontSize 10** (overrides micro token's 9), `letterSpacing: 1.4` (overrides token 1.3), color cream #FFF7E8. Content: `(t.date_label ?? "—").toUpperCase()` — **see red flag §9.1: `date_label` is not on the ArchiveTile type; with typed data this always renders "—"**.
- Question text: family **"HankenGrotesk_700"**, fontSize **11**, lineHeight **14**, color inkSoft, `numberOfLines={3}`, marginBottom 8 (sp[2]).
- Verdict text: family BagelFatOne (typography.h3.family) but fontSize **18** / lineHeight **18** (overrides h3's 22/28), color pink #FF4FA3, `numberOfLines={1}`, marginBottom 8.
- Thumbnail wrapper `styles.thumb` is `{}` (no styling).

### 4.5 ArchiveTileThumbnail (entire component)

```tsx
const FILLS = [palette.mint, palette.lemon, palette.blue, "#FFD7E8"] as const;
// = ["#7AE6C3", "#FFDF6B", "#7BC8F6", "#FFD7E8"]

export function ArchiveTileThumbnail({ texts }: Props) {
  const visible = texts.slice(0, 3);
  if (visible.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {visible.map((t, i) => (
        <View key={`${t}-${i}`} testID="archive-thumb-bubble"
              style={[styles.bubble, { backgroundColor: FILLS[i % FILLS.length], transform: [{ scale: 1 - i * 0.12 }] }]}>
          <Text style={styles.bubbleText} numberOfLines={1}>{t}</Text>
        </View>
      ))}
    </View>
  );
}
```

- Max **3** bubbles (`slice(0,3)`); empty → renders nothing.
- Bubble i (0-based): fill `FILLS[i]` (mint, lemon, blue — 4th fill #FFD7E8 unreachable with max 3), scale `1 - i*0.12` → 1.0, 0.88, 0.76 (scale about center).
- wrap: horizontal row, `gap: 6`, `flexWrap: "wrap"`.
- bubble: border ink width 2, radius **14** (radii.s), paddingH **8**, paddingV **4**.
- bubbleText: HankenGrotesk_700, size **11**, color ink, 1 line.

---

## 5. ArchiveDetailScreen — `src/screens/ArchiveDetailScreen.tsx`

Props: `{ questionId: string }`.

### 5.1 State machine + effects (verbatim)

```ts
type State =
  | { kind: "loading" }
  | { kind: "ready"; detail: ArchiveDetail }
  | { kind: "error" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}
```

```tsx
useEffect(() => {
  let cancelled = false;
  setState({ kind: "loading" });
  fetchArchiveDetail(questionId)
    .then((detail) => { if (!cancelled) setState({ kind: "ready", detail }); })
    .catch(() => { if (!cancelled) setState({ kind: "error" }); });
  return () => { cancelled = true; };
}, [questionId]);

useEffect(() => {
  let cancelled = false;
  getHiddenClusterIds().then((ids) => { if (!cancelled) setHiddenIds(ids); });
  return () => { cancelled = true; };
}, []);
```

Hidden IDs are loaded **once on mount** (not re-read when returning to the screen within its lifetime); afterwards updated only via local `handleHidden`.

### 5.2 Visible-clusters gate incl. demo fallback (verbatim)

```tsx
// Hooks must run in the same order on every render — keep this useMemo
// ABOVE the loading/error early returns. Falls back to [] when detail isn't ready yet.
const visibleClusters = useMemo(() => {
  if (state.kind !== "ready") return [];
  const real = state.detail.top_clusters.filter((c) => !hiddenIds.has(c.id));
  // Guideline 1.2 fallback: a revealed drop with no surviving answers still
  // shows innocuous demo answers so report / hide / block is always exercisable.
  if (real.length > 0) return real;
  return DEMO_ARCHIVE_CLUSTERS.filter((c) => !hiddenIds.has(c.id));
}, [state, hiddenIds]);

const handleHidden = (id: string) => {
  setHiddenIds((prev) => { const next = new Set(prev); next.add(id); return next; });
};
```

Demo fallback data (`src/lib/demoContent.ts`), computed at module load:

```ts
const DEMO_CLUSTER_SEED = [
  { id: "demo-cl-1",  canonical_text: "pumpkin spice latte", submission_count: 47 },
  { id: "demo-cl-2",  canonical_text: "caramel macchiato",   submission_count: 39 },
  { id: "demo-cl-3",  canonical_text: "frappuccino",         submission_count: 31 },
  { id: "demo-cl-4",  canonical_text: "flat white",          submission_count: 24 },
  { id: "demo-cl-5",  canonical_text: "matcha latte",        submission_count: 19 },
  { id: "demo-cl-6",  canonical_text: "cold brew",           submission_count: 15 },
  { id: "demo-cl-7",  canonical_text: "oat milk latte",      submission_count: 12 },
  { id: "demo-cl-8",  canonical_text: "espresso martini",    submission_count: 9  },
  { id: "demo-cl-9",  canonical_text: "chai latte",          submission_count: 7  },
  { id: "demo-cl-10", canonical_text: "americano",           submission_count: 5  },
];
const DEMO_TOTAL = DEMO_CLUSTER_SEED.reduce((s, c) => s + c.submission_count, 0); // = 208

export const DEMO_ARCHIVE_CLUSTERS = DEMO_CLUSTER_SEED.map((c, i) => ({
  id: c.id,
  canonical_text: c.canonical_text,
  final_rank: i + 1,
  final_pct_of_total: c.submission_count / DEMO_TOTAL,
}));
```

So demo pct values: 47/208≈0.2260 → "22.6%", 39/208 → "18.8%", 31/208 → "14.9%", 24/208 → "11.5%", 19/208 → "9.1%", 15/208 → "7.2%", 12/208 → "5.8%", 9/208 → "4.3%", 7/208 → "3.4%", 5/208 → "2.4%".
Note: `DEMO_ARCHIVE_CLUSTERS` items lack `submission_count` — the screen never uses it.

### 5.3 Loading / error views

Loading: centered column (background cream, gap 12), `ActivityIndicator` color pink #FF4FA3 size "large", below it text **"loading…"** (HankenGrotesk_700 15, inkSoft). (Uses U+2026 ellipsis char.)

Error: centered, text **"couldn't load this archive entry."** — HankenGrotesk_700 15, color red #FF5A4F, centered, paddingHorizontal 24 (sp[5]).

### 5.4 Ready layout (top → bottom)

Root: `flex:1`, background cream, **paddingTop 48** (sp[7]) — content starts 48pt down (no safe-area inset used here!), `PaperTexture` behind.

1. **Header row** (`flexDirection:row`, `alignItems:flex-start`, paddingH 22 (gutter), paddingTop 12 (sp[3]), paddingBottom 16 (sp[4]), gap 12, bottom border: ink, width 2):
   - Left column (`flex:1`):
     - **Date tab**: self-start, background ink, paddingH 8, paddingV 4, radius 6, marginBottom 8. Text = `formatDate(detail.created_at).toUpperCase()` (device-locale `toLocaleDateString`, e.g. "5/9/2026"), font SpaceGrotesk_700 size **10**, letterSpacing 1.4, color cream.
     - **Verdict**: `visibleClusters[0]?.canonical_text ?? ""` — BagelFatOne **36/44** (typography.h2), color pink, marginBottom 8. (Derived from the top *visible* cluster, not a server verdict field — hiding rank 1 changes the headline; on demo fallback it's "pumpkin spice latte".)
     - **Question**: `detail.text` — HankenGrotesk_700 **17/24** (bodyL), color inkSoft.
   - Right: **ShareButton** with `label="SHARE"`, `banner_type="verdict"`, `question_id=detail.id`, `share_target="system"`, `viewRef=shareCardRef`.
     - ShareButton visuals: row, centered, gap 8, `minHeight 44`, background mint #7AE6C3, border ink 2, radius pill (999), paddingH 16, paddingV 8, shadow s (2,2,0); contains `IconShare size=16 color=ink` + label text (exact: **"SHARE"**) HankenGrotesk_700 13, letterSpacing 0.5, ink. On error: `console.warn("share failed", e)` only, no alert.
2. **Moderation hint** (exact string): **"Tap ⋯ on any answer to hide or report it"** — HankenGrotesk_700 13 (bodyS), inkSoft, centered, paddingVertical 8 (sp[2]). (⋯ = U+22EF midline horizontal ellipsis.)
3. **FlatList of visibleClusters** (`keyExtractor: c.id`, `contentContainerStyle: { paddingBottom: 120 }`). Each row (`flexDirection:row`, `alignItems:center`, paddingH 22, paddingV 12, gap 12, bottom border cream2 #FBEED1 width 1):
   - **Rank badge**: 36×36, radius **14** (radii.s), background lemon #FFDF6B, border ink 2, centered content, shadow s (2,2,0). Text: `#{item.final_rank}` (e.g. "#1") — SpaceGrotesk_600 (typography.label.family) size 11, letterSpacing 1.1, color ink.
   - **Canonical text**: `item.canonical_text`, `numberOfLines={2}`, HankenGrotesk_700 15, ink, `flex:1`.
   - **Percentage**: `(item.final_pct_of_total * 100).toFixed(1)` + "%" → e.g. `0.31 → "31.0%"` — HankenGrotesk_700 13, inkSoft.
   - **Moderation button** (Pressable): min 36×36, centered, `hitSlop 8`, `accessibilityRole="button"`, `accessibilityLabel={`Hide or report "${item.canonical_text}"`}` (with literal double quotes around the text). Glyph: **"⋯"** — BagelFatOne 22 / lineHeight 24, inkSoft. onPress → `openClusterModerationSheet(item.id, item.canonical_text, handleHidden)`.
4. **Offscreen share card**: `<View ref={shareCardRef} collapsable={false} pointerEvents="none" style={{position:"absolute", left:-10000, top:-10000, opacity:0}}>` containing:

```tsx
<ShareCardVerdict
  verdictText={verdict}
  topClusters={visibleClusters.map((c) => ({ canonical_text: c.canonical_text, final_rank: c.final_rank }))}
  userRank={null}
  percentile={null}
  date={formatDate(detail.created_at)}
/>
```

It is ALWAYS mounted (unlike the archive tab where it mounts only during a long-press share).

---

## 6. Moderation action sheet — `src/lib/clusterModeration.ts` (behavioral spec, verbatim)

```ts
export function openClusterModerationSheet(
  id: string,
  text: string,
  onHidden?: (id: string, text: string) => void,
): void {
  const doHide = async () => {
    try {
      await hideCluster({ id, text });
      onHidden?.(id, text);
    } catch (err) {
      Alert.alert("Couldn't hide", err instanceof Error ? err.message : String(err));
    }
  };

  const doReport = async () => {
    // Remove from the feed immediately, then report best-effort.
    await hideCluster({ id, text });
    onHidden?.(id, text);
    try {
      const deviceToken = await getDeviceToken();
      await reportContent({ target_type: "cluster", target_id: id, device_token: deviceToken });
    } catch {
      /* anonymous / offline / demo content — local removal already applied */
    }
    Alert.alert("Thanks for reporting", "We removed it from your feed and will review within 24 hours.");
  };

  const doBlock = async () => {
    await hideCluster({ id, text });
    await addBlockedUser({ user_id: `contributor:${id}`, handle: text });
    onHidden?.(id, text);
    try {
      const deviceToken = await getDeviceToken();
      await reportContent({
        target_type: "cluster",
        target_id: id,
        reason: "blocked contributor",
        device_token: deviceToken,
      });
    } catch {
      /* local block already applied */
    }
    Alert.alert("Blocked", "We won't show this contributor's answers again.");
  };

  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Cancel", "Hide this answer", "Report this answer", "Block this contributor"],
        destructiveButtonIndex: 3,
        cancelButtonIndex: 0,
        title: `"${text}"`,
      },
      (index) => {
        if (index === 1) doHide();
        if (index === 2) doReport();
        if (index === 3) doBlock();
      },
    );
  } else { /* Android Alert fallback — not needed for SwiftUI port */ }
}
```

iOS sheet strings (exact): title `"<answer text>"` (in literal double quotes); buttons **"Cancel"** (cancel), **"Hide this answer"**, **"Report this answer"**, **"Block this contributor"** (destructive/red).
Alert strings (exact, title / message):
- **"Couldn't hide"** / error message text.
- **"Thanks for reporting"** / **"We removed it from your feed and will review within 24 hours."** (shown even if server report failed — local removal already applied).
- **"Blocked"** / **"We won't show this contributor's answers again."**

Ordering guarantee: local hide always FIRST (offline-safe, works on demo content and anonymous users), server report best-effort afterwards, confirmation alert always shown. `device_token` comes from `getDeviceToken()` (SecureStore-cached identifierForVendor, else `anon-<random>`).

---

## 7. Persistence — `src/lib/hiddenContentStore.ts`

Storage: **AsyncStorage** (deliberately NOT Keychain/SecureStore — code comment: "Keychain has a ~2KB-per-value limit on iOS that can fail for power users"). SwiftUI equivalent: UserDefaults or a file, not Keychain.

Keys (exact):
- `"ugc_hidden_clusters_v1"` → JSON array of `HiddenCluster`
- `"ugc_blocked_users_v1"` → JSON array of `BlockedUser`

Stored JSON shapes:

```ts
export interface HiddenCluster { id: string; text: string; hidden_at: number }   // Date.now() epoch ms
export interface BlockedUser  { user_id: string; handle: string | null; blocked_at: number }
```

Semantics (verbatim-equivalent):
- Read: missing key → `[]`; non-array or corrupt JSON → `[]` (silent).
- `hideCluster({id,text})`: no-op if id already present; otherwise **unshift** (newest first) `{id, text, hidden_at: Date.now()}` and write whole array.
- `unhideCluster(id)`: filter out by id, rewrite.
- `addBlockedUser`: same dedupe-by-user_id + unshift `{user_id, handle, blocked_at: Date.now()}`.
- `removeBlockedUser(user_id)`: filter, rewrite.
- `getHiddenClusterIds()` / `getBlockedUserIds()` → `Set` of ids.
- Block from moderation sheet stores `user_id: "contributor:<clusterId>"`, `handle: <answer text>`.

Blocked users are surfaced/reversible elsewhere (ME/settings tab); the archive detail screen filters ONLY by hidden cluster ids (block also hides via `hideCluster`, so the row disappears anyway).

---

## 8. PaperTexture (background, both screens)

Full-screen non-interactive overlay (`pointerEvents:"none"`, absolute fill) drawing a dot grid at **6% opacity**: repeating 12×12pt pattern, one circle per cell at (1,1) radius **1**, fill ink #1A1A1A. SwiftUI: `Canvas`/tiled image over the cream background, `allowsHitTesting(false)`.

---

## 9. Red flags / surprising behaviors for a 1:1 port

1. **`t.date_label` bug/ghost field** (`ArchiveScreen.tsx` line 59): `ArchiveTile` has no `date_label` property (only `created_at`); the expression `(t.date_label ?? "—").toUpperCase()` compiles only because the JSON cast is unvalidated. Unless the server actually includes `date_label` in `/api/archive` tiles (check backend `api/` repo!), every list tile's date tab renders **"—"**. Detail screen instead formats `created_at`. Decide: replicate faithfully (render `date_label` if present in payload else "—") or fix to format `created_at`.
2. **No loading indicator on the archive tab**: during the initial fetch, `tiles=[]` shows the "fresh archive" empty state, which then swaps to the list. A 1:1 port shows the empty card briefly on every cold open.
3. **Ad rows render nothing** but still exist in the data source; with the list's `gap: 16`, an empty RN cell at every 8th position produces a double gap (~32pt) there. Decide whether to reproduce the double-gap artifact or drop ad rows entirely.
4. **Detail "verdict" headline is derived, not stored**: `visibleClusters[0]?.canonical_text ?? ""` — changes when the user hides the #1 answer, and becomes "pumpkin spice latte" (demo) when all real clusters are hidden or the drop has zero clusters. The demo fallback is an App Review Guideline 1.2 requirement — do not remove it.
5. **Demo fallback filtering also respects hiddenIds** — a user can hide all 10 demo clusters, leaving an empty list (and empty verdict "").
6. **Token overrides**: date tab text uses micro family at size 10 / letterSpacing 1.4 (token says 9/1.3); tile verdict uses h3 family at 18/18 (token 22/28); tile question hardcodes "HankenGrotesk_700" 11/14. Don't blindly apply tokens.
7. **Dates are device-locale** `toLocaleDateString()` (uppercased in tabs) — use `DateFormatter` with `.short` style, not a fixed format.
8. **Hidden ids load once per screen mount**; hides done elsewhere while the detail screen is alive won't propagate until re-mount.
9. **Share flow ordering**: `trackShare` server call happens BEFORE image capture; if it fails, no share sheet appears (silent on the tab long-press; `console.warn` on the detail button). Long-press share requires rendering the card offscreen first (RAF-deferred), capture at 1x PNG to tmpfile, then system share sheet with title "Share to…".
10. **Detail screen has no back button and no nav header** (`headerShown:false`; route hidden from tab bar via `href:null`); the custom StickerTabBar remains visible. Root uses fixed paddingTop 48 instead of safe-area insets.
11. **"Report" always shows the thank-you alert** even if the network report failed (by design, offline-safe). "Hide" is the only path that surfaces an error alert.
12. **`fetchArchive`/`fetchArchiveDetail` send no auth headers**; `reportContent` does. Base URL from `EXPO_PUBLIC_API_URL` env (fallback `http://localhost:3000`).
13. **Empty-state card and tiles rotate**: card -1.5°, tiles alternate ∓1.5° by tile index — the sticker aesthetic depends on these rotations and the hard (blur-0, opacity-1) ink shadows.

---

## 10. Test vectors (→ XCTest fixtures)

From `ArchiveScreen.test.tsx` (tile factory: `question_id: "q-<i>"`, `question_text: "question <i>?"`, `verdict_text: top[0] ?? ""`, `top_clusters: ["a","b","c"]`, `created_at: new Date(2026, 4, 9 - i).toISOString()` — month 4 = May):
- tiles `[]` → screen contains text matching /fresh archive/i.
- tiles `[tile(0), tile(1), tile(2)]` → texts "question 0?", "question 1?", "question 2?" all present.
- 17 tiles → exactly **2** ad slots (after tiles 8 and 16).
- Tap on "question 1?" tile → `onTilePress("q-1")`.
- Long-press on "question 0?" tile → `onTileLongPress` receives the full tile struct.

From `ArchiveDetailScreen.test.tsx`:
- Pending fetch → text matching /loading/i visible.
- Resolved with `{ id:"q1", text:"what's the most overrated tourist trap?", created_at:"2026-05-09T00:00:00.000Z", top_clusters:[ {id:"c1", canonical_text:"Pisa Tower", submission_count:412, final_rank:1, final_pct_of_total:0.31}, {id:"c2", canonical_text:"Eiffel Tower", submission_count:80, final_rank:2, final_pct_of_total:0.06} ] }` → question text visible; "Pisa Tower" and "Eiffel Tower" appear (in list AND offscreen share card → expect ≥1 occurrence each). Percentages render as "31.0%" and "6.0%"; ranks "#1", "#2"; verdict headline "Pisa Tower".
- Rejected fetch → text matching /couldn't load/i.

From `ArchiveTileThumbnail.test.tsx`:
- `texts=[]` → 0 bubbles (view absent).
- `texts=["a","b","c","d","e","f","g"]` → exactly 3 bubbles.
- `texts=["yes","no","maybe"]` → each text rendered exactly once; fills mint/lemon/blue; scales 1.0/0.88/0.76.

Derived (from demoContent): all-hidden or empty `top_clusters` on a ready detail → list shows the 10 demo coffee clusters with ranks #1–#10 and pcts 22.6/18.8/14.9/11.5/9.1/7.2/5.8/4.3/3.4/2.4 %.
