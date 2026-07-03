# Relatably — Reveal Animation + Share Pipeline: 1:1 Port Spec

Source files (root `/Users/levinschwab/Data/Claude/relatably/ios`):
- `src/components/RevealAnimation.tsx` (+ `.test.tsx`)
- `src/lib/shareCard.ts` (+ `.test.ts`)
- `src/components/ShareButton.tsx` (+ `.test.tsx`)
- `src/components/ShareCardVerdict.tsx`, `ShareCardCalledIt.tsx`, `ShareCardTodaysTake.tsx` (+ tests)
- `src/components/icons/IconShare.tsx`
- `src/lib/branch.ts`, `src/lib/api.ts` (trackShare), `src/types/api.ts`
- Usage sites: `app/(tabs)/index.tsx`, `src/screens/WordcloudScreen.tsx`, `src/screens/ArchiveDetailScreen.tsx`
- Design tokens: `src/theme/tokens.ts`

---

## 0. Design tokens (referenced throughout)

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
  // BagelFatOne is a tall, heavy-ascender display face. On iOS the line box is
  // clamped to lineHeight, so a lineHeight <= fontSize clips the top of the
  // glyphs. Display tokens therefore need headroom (~1.2x size).
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

All shadows are HARD sticker shadows: radius 0, opacity 1, ink color, offset (2,2)/(4,4)/(6,6).

Data type used everywhere:
```ts
export interface YesterdayCluster {
  id: string;
  canonical_text: string;
  submission_count: number;
  final_rank: number;          // 1 = winner
  final_pct_of_total: number;  // fraction, e.g. 0.18
}
export type BannerType = "todays_take" | "verdict" | "called_it";
export type ShareTarget = "ig_story" | "tiktok" | "snap" | "imessage" | "system";
export interface ShareTrackRequest { banner_type: BannerType; question_id: string; share_target: ShareTarget; }
export interface ShareTrackResponse { referral_code: string; }
```

---

## 1. RevealAnimation

### 1.1 Props / defaults
```ts
interface Props {
  questionId?: string;          // when absent → "Phase-2 mode": no CTAs, auto-advance
  questionText: string;
  clusters: YesterdayCluster[]; // assumed sorted ascending by final_rank
  selfClusterId: string | null;
  selfHandle?: string | null;   // default null
  dateLabel?: string;           // default ""
  onComplete: () => void;
  intervalMs?: number;          // default 1000
}
const DEFAULT_INTERVAL_MS = 1000;
const HOLD_MS_DEFAULT = 2000;
```

### 1.2 State machine / timing (verbatim)
```ts
// Reveal order is #10 → #1 (descending rank).
const reversed = [...clusters].sort((a, b) => b.final_rank - a.final_rank);
const [step, setStep] = useState(0);
const onCompleteRef = useRef(onComplete);
onCompleteRef.current = onComplete;
const verdictRef = useRef<View>(null);
const calledItRef = useRef<View>(null);

useEffect(() => {
  const total = reversed.length;
  let current = 0;

  const interval = setInterval(() => {
    current += 1;
    setStep(current);
    if (current >= total) {
      clearInterval(interval);
      // When share CTAs are not active (no questionId), auto-advance
      // after a final hold to preserve Phase-2 behavior.
      if (!questionId) {
        const holdMs = intervalMs * (HOLD_MS_DEFAULT / DEFAULT_INTERVAL_MS);
        setTimeout(() => onCompleteRef.current(), holdMs);
      }
    }
  }, intervalMs);

  return () => clearInterval(interval);
}, [intervalMs, reversed.length, questionId]);

const done = step >= reversed.length;
const visible = done ? [] : reversed.slice(0, step);
const verdict = clusters.find((c) => c.final_rank === 1);
```
Key semantics:
- Every `intervalMs` (1000 ms) one more bubble appears, worst-ranked first (#10, then #9, …).
- On the FINAL tick (`step == clusters.length`) `done` becomes true and **all bubbles disappear** (`visible = []`) — replaced by the verdict line.
- If `questionId` is falsy: after the last tick, wait `intervalMs * 2` (i.e. 2000 ms at default speed — hold scales with interval), then call `onComplete` once. No buttons shown.
- If `questionId` is truthy: NO auto-advance; user must tap "continue →".

### 1.3 Rank / percentile / called-it math (verbatim)
```ts
const userRank = selfClusterId
  ? (clusters.findIndex((c) => c.id === selfClusterId) + 1) || null
  : null;
const userPercentile =
  userRank !== null && clusters.length > 0
    ? Math.max(
        0,
        Math.min(
          100,
          Math.floor(((clusters.length - userRank + 1) / clusters.length) * 100),
        ),
      )
    : null;
const calledIt = !!selfClusterId && verdict?.id === selfClusterId;
```
Notes: `userRank` is the INDEX in the passed array + 1 (not `final_rank`); `findIndex === -1` → `(−1+1)||null` → `null`. Percentile example: 10 clusters, rank 1 → floor(10/10*100)=100; rank 10 → floor(1/10*100)=10.

### 1.4 Bubble font-size formula
```ts
{ fontSize: 14 + c.final_pct_of_total * 40 }
```
Applied per bubble (pct is a 0..1 fraction, so max realistic size ≈ 14–54 pt).

### 1.5 Component tree / layout
```
View container  (flex:1, bg cream #FFF7E8, paddingTop 60, paddingHorizontal 22 (sp.gutter), alignItems center)
├─ Text question (color ink, font BagelFatOne 36/44 = typography.h2, textAlign center, marginBottom 24 (sp[5]))
├─ View cloud (flex:1, row, wrap, justifyContent center, alignItems center)
│   └─ Text bubble ×step   (color inkSoft #4A4541, font HankenGrotesk_700, margin 6,
│                           fontSize = 14 + pct*40)
│       selfBubble extra:   color pink #FF4FA3; textShadowColor pink; textShadowRadius 6
│                           ("hot-pink ring shadow instead of neon glow")
├─ [done && verdict] Text verdict:  "the world said — {verdict.canonical_text}"
│       (color pink, font BagelFatOne 40/48 = typography.h1, marginVertical 24, textAlign center)
├─ [done && questionId] View cta (gap 12 (sp[3]), paddingVertical 16 (sp[4]), width "100%")
│   ├─ Pressable shareBtn  → label "SHARE THE VERDICT"
│   │     bg pink, paddingHorizontal 24 (sp[5]), paddingVertical 14, borderRadius 999 (pill),
│   │     alignItems center, borderWidth 2 borderColor ink,
│   │     shadow.s: color ink, offset (2,2), radius 0, opacity 1, elevation 2
│   ├─ [calledIt] Pressable shareBtn+crownBtn → label "★ SHARE — YOU CALLED IT"
│   │     same as shareBtn but bg lemon2 #FFD43B
│   │   shareLabel style: color ink, font SpaceGrotesk_600 (typography.label.family),
│   │     letterSpacing 1.1, fontWeight "900"
│   └─ Pressable continueBtn → label "continue →"
│         paddingVertical 12 (sp[3]), alignItems center
│         continueLabel: color inkSoft, font HankenGrotesk_700 size 13 (typography.bodyS)
└─ [questionId] View offscreen (position absolute, left -10000, top -10000, opacity 0,
                                pointerEvents none, collapsable={false})
    ├─ View ref=verdictRef  → <ShareCardVerdict …/>
    └─ View ref=calledItRef → <ShareCardCalledIt …/>
```

### 1.6 Data fed into the offscreen share cards (verbatim)
```ts
<ShareCardVerdict
  verdictText={verdict?.canonical_text ?? ""}
  topClusters={clusters
    .slice()
    .sort((a, b) => a.final_rank - b.final_rank)
    .slice(1, 7)                       // ranks 2..7 → the 6 satellites
    .map((c) => ({ canonical_text: c.canonical_text, final_rank: c.final_rank }))}
  userRank={userRank}
  percentile={userPercentile}
  date={dateLabel}
/>
<ShareCardCalledIt
  verdictText={verdict?.canonical_text ?? ""}
  clusterCount={verdict?.submission_count ?? 0}
  handle={selfHandle}
  date={dateLabel}
/>
```

### 1.7 Share handlers (verbatim)
```ts
const onShareVerdict = async () => {
  if (!questionId) return;
  try {
    await shareCardImage({
      viewRef: verdictRef as unknown as React.RefObject<unknown>,
      banner_type: "verdict",
      question_id: questionId,
      share_target: "system",
    });
  } catch (e) {
    console.warn("share verdict failed", e);
  }
};
// onShareCalledIt identical but calledItRef + banner_type "called_it",
// warn message: "share called-it failed"
```

### 1.8 Caller (app/(tabs)/index.tsx, reveal phase)
```tsx
{phase === "reveal" && yesterday && (
  <RevealAnimation
    questionId={yesterday.id}
    questionText={yesterday.text}
    clusters={yesterday.top_clusters}
    selfClusterId={yesterday.self_cluster_id}
    onComplete={handleRevealComplete}
  />
)}
```
IMPORTANT: caller passes NO `dateLabel` (→ `""` on both cards) and NO `selfHandle` (→ "@anonymous" on called-it card) and NO `intervalMs` (→ 1000 ms).

---

## 2. shareCardImage (src/lib/shareCard.ts) — full file verbatim

```ts
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
```

Order of operations (must preserve): availability check → `trackShare` POST (throws on !ok → aborts share) → shareUrl construction → PNG capture (tmp file, quality 1) → system share sheet → return.

### 2.1 Backend call (src/lib/api.ts)
```ts
export async function trackShare(req: ShareTrackRequest): Promise<ShareTrackResponse> {
  const auth = await authHeaders();
  const res = await fetch(`${BASE}/api/share/track`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify(req),
  });
  if (!res.ok) throw new Error(`trackShare: ${res.status}`);
  return res.json();
}
```
POST `/api/share/track`, body = `{ banner_type, question_id, share_target }`, response `{ referral_code }`.

### 2.2 Branch gating (src/lib/branch.ts, verbatim behavior)
```ts
let cachedEnabled: boolean | undefined;
export function isBranchEnabled(): boolean {
  if (cachedEnabled === undefined) {
    cachedEnabled = (process.env.EXPO_PUBLIC_BRANCH_KEY ?? "") !== "";
  }
  return cachedEnabled;
}
// v1.0 ships without the Branch.io native module. isBranchEnabled()
// is env-gated to false so these are unreachable at runtime.
export async function createBranchUniversalLink(_opts): Promise<string | null> {
  if (!isBranchEnabled()) return null;
  return null;   // stub — always null even when "enabled"
}
```
Fallback URL format: `https://relatably.app/?r=<url-encoded referral_code>`.
NOTE: `shareUrl` is computed and returned but NOT embedded in the PNG and NOT passed to the share sheet (only the PNG file is shared). Swift port: keep computing/returning it (analytics/tests) but nothing user-visible depends on it in v1.0.

### 2.3 Test vectors (shareCard.test.ts → XCTest fixtures)
| # | Setup | Input | Expected |
|---|-------|-------|----------|
| 1 | trackShare→`{referral_code:"abc.def"}`, capture→`file:///tmp/share.png`, sharing available | `{banner_type:"todays_take", question_id:"q1", share_target:"system"}` | trackShare called with exactly that body; capture with `format:"png", quality:1`; shareAsync called with `file:///tmp/share.png` |
| 2a | Branch enabled, link→`https://relatably.app.link/abc` | `{banner_type:"verdict", question_id:"q2", share_target:"tiktok"}` | result.shareUrl == `https://relatably.app.link/abc` |
| 2b | Branch disabled (link null), referral_code `abc.def` | same | result.shareUrl == `https://relatably.app/?r=abc.def` |
| 3 | `isAvailableAsync` → false | `{banner_type:"called_it", question_id:"q3", share_target:"system"}` | throws, message matches `/sharing not available/i` |

---

## 3. ShareButton

### 3.1 Full behavior (verbatim)
```tsx
interface Props {
  viewRef: React.RefObject<unknown>;
  banner_type: BannerType;
  question_id: string;
  share_target?: ShareTarget;   // default "system"
  label?: string;               // default "SHARE"
}

export function ShareButton({ viewRef, banner_type, question_id, share_target = "system", label = "SHARE" }: Props) {
  const onPress = async () => {
    try {
      await shareCardImage({ viewRef, banner_type, question_id, share_target });
    } catch (e) {
      console.warn("share failed", e);
    }
  };
  return (
    <Pressable role="button" onPress={onPress} style={styles.btn}>
      <IconShare size={16} color={palette.ink} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
```

### 3.2 Styles
```
btn:   row, alignItems center, justifyContent center, gap 8 (sp[2]),
       minHeight 44,
       bg mint #7AE6C3, borderColor ink, borderWidth 2, borderRadius 999 (pill),
       paddingHorizontal 16 (sp[4]), paddingVertical 8 (sp[2]),
       shadow.s (ink, offset 2/2, radius 0, opacity 1, elevation 2)
label: font HankenGrotesk_700 (typography.body.family), fontSize 13, letterSpacing 0.5, color ink
```

### 3.3 IconShare (custom SVG, 24×24 viewBox, rendered at size 16, color ink)
```
Circle cx=6  cy=12 r=2.5 stroke=color strokeWidth=2
Circle cx=18 cy=6  r=2.5 stroke=color strokeWidth=2
Circle cx=18 cy=18 r=2.5 stroke=color strokeWidth=2
Path "M8 11L16 7M8 13L16 17" stroke=color strokeWidth=2 strokeLinecap="square"
```
(Classic 3-node share glyph; strokes only, no fill.)

### 3.4 Test vectors (ShareButton.test.tsx)
- Press → `shareCardImage` called with `{viewRef, banner_type:"todays_take", question_id:"q1", share_target:"system"}` (exact pass-through).
- Renders the given custom label verbatim (test uses "🚀 share").

### 3.5 Usage sites
- **WordcloudScreen** header row (right of counter): `banner_type="todays_take"`, `share_target="system"`, `label="SHARE"`. Gate: `shareEnabled = !!(questionId && questionText && userAnswer && dateLabel)` — button AND offscreen card only rendered when all four truthy. `dateLabel` from caller = `new Date().toISOString().slice(0, 10)` (e.g. "2026-07-02").
- **ArchiveDetailScreen** header row: `banner_type="verdict"`, `share_target="system"`, `label="SHARE"`, date = `formatDate(detail.created_at)`; offscreen `ShareCardVerdict` with `userRank={null}, percentile={null}` (always the anonymous fallback line) and `topClusters = visibleClusters.map(...)` — NOT sliced from rank 2, so satellite #1 duplicates the verdict text (see §7 red flags).

---

## 4. Share cards (offscreen 1080×1920 PNG composition)

All three cards: fixed `width: 1080, height: 1920` (9:16 story format), `padding: 96`. They are mounted OFFSCREEN inside a wrapper:
```
offscreen wrapper: position absolute, left -10000, top -10000, opacity 0,
                   pointerEvents "none", collapsable={false}
inner capture View: collapsable={false}  (holds the ref passed to captureRef)
```
Swift equivalent: render the card view hierarchy at exactly 1080×1920 pt and snapshot to PNG (e.g. `ImageRenderer` with fixed proposed size / scale 1), never on screen.

### 4.1 ShareCardVerdict — "the world said" card
Props: `verdictText: string; topClusters: {canonical_text, final_rank}[]; userRank: number|null; percentile: number|null; date: string`.
Logic: `const satellites = topClusters.slice(0, 6);` verdict rendered as `verdictText.toUpperCase()`.

Tree (root `justifyContent: "space-between"`, bg cream #FFF7E8):
```
card 1080×1920, padding 96, bg cream, space-between (4 children spread vertically)
├─ header (row, space-between, alignItems center)
│   ├─ Text "RELATABLY"      → ink, 56pt, BagelFatOne, letterSpacing 2
│   └─ Text {date}           → inkSoft, 36pt, HankenGrotesk_700
├─ headerStrip (bg ink, paddingH 32, paddingV 20, borderRadius 12, alignSelf flex-start)
│   └─ Text "YESTERDAY · THE WORLD SAID —"   → cream, 36pt, HankenGrotesk_700,
│                                              letterSpacing 2, uppercase
├─ Text {VERDICT UPPERCASED} → pink #FF4FA3, 144pt, BagelFatOne, letterSpacing 4,
│        textAlign left, transform rotate(-2deg),
│        textShadow: color ink, offset (6,6), radius 0   ← hard sticker shadow
├─ satellites (row, wrap, gap 24)
│   └─ Text {canonical_text} ×≤6 → inkSoft, 40pt, HankenGrotesk_700
└─ rankLine → ink, 40pt, HankenGrotesk_700
     signed-in:  "I ranked #{userRank}. Better than {percentile}% of the world."
     anonymous:  "sign in next time to claim a rank."
```
testIDs: root `share-card-verdict`, each satellite `verdict-satellite`.

Test vectors (ShareCardVerdict.test.tsx):
- Props `{verdictText:"PISA TOWER", userRank:14, percentile:87, date:"May 8, 2026"}` → texts "PISA TOWER", "I ranked #14", "Better than 87%" present.
- 10 topClusters in → exactly 6 satellites rendered.
- `userRank:null, percentile:null` → "sign in next time…" shown, "I ranked" absent.

### 4.2 ShareCardCalledIt — winner brag card
Props: `verdictText: string; clusterCount: number; handle: string|null; date: string`.
Logic (verbatim):
```ts
const display = handle ? `@${handle}` : "@anonymous";
const formatted = clusterCount.toLocaleString("en-US");   // "412,381"
```
Tree (root centered both axes, bg lemon2 #FFD43B):
```
card 1080×1920, padding 96, bg lemon2, justifyContent center, alignItems center
├─ headerBadge (row, alignItems center, gap 16, bg ink, paddingH 48, paddingV 24,
│               borderRadius pill(999), marginBottom 64,
│               shadow.m: ink, offset (4,4), radius 0, opacity 1, elevation 4)
│   └─ Text "★ I CALLED IT ★"  → cream, 56pt, BagelFatOne, letterSpacing 2
├─ Text {VERDICT UPPERCASED}   → ink, 144pt, BagelFatOne, textAlign center,
│        letterSpacing 4, marginBottom 64,
│        textShadow: color inkSoft #4A4541, offset (4,4), radius 0
├─ Text "• {formatted} of you agreed •" → inkSoft, 40pt, HankenGrotesk_700,
│        center, marginVertical 32
├─ Text {display}              → ink, 56pt, HankenGrotesk_700, center,
│        marginTop 96, fontWeight 800
└─ Text "RELATABLY · {date}"   → inkSoft, 32pt, HankenGrotesk_700, center,
         marginTop 32, letterSpacing 2
```
testID root: `share-card-called-it`.

Test vectors: `{verdictText:"pisa tower", clusterCount:412381, handle:"ick_of_the_day", date:"May 8, 2026"}` → "I CALLED IT" present, "PISA TOWER" (uppercased), "@ick_of_the_day", "412,381"; `handle:null` → "@anonymous".

### 4.3 ShareCardTodaysTake — pre-reveal answer card
Props: `questionText: string; userAnswer: string; date: string`. Constants `CARD_WIDTH = 1080; CARD_HEIGHT = 1920`. Answer rendered `userAnswer.toUpperCase()`.
```
card 1080×1920, padding 96, bg cream, justifyContent space-between
├─ header (row, space-between, center)
│   ├─ Text "RELATABLY" → ink, 56pt, BagelFatOne, letterSpacing 2
│   └─ Text {date}      → inkSoft, 36pt, HankenGrotesk_700
├─ Text "your take —"   → inkSoft, 40pt, HankenGrotesk_700, letterSpacing 1,
│        uppercase (renders as "YOUR TAKE —"), marginTop 96
├─ Text {questionText}  → ink, 64pt, BagelFatOne, lineHeight 80
└─ answerBox (borderColor ink, borderWidth 6, padding 64, center both axes,
│             borderRadius 36 (radii.xl), bg cream2 #FBEED1,
│             shadow.l: ink, offset (6,6), radius 0, opacity 1, elevation 6)
    └─ Text {ANSWER UPPERCASED} → pink, 96pt, BagelFatOne, letterSpacing 2, center
```
testID root: `share-card-todays-take`.

Test vectors: renders "RELATABLY", the date, question substring, "EIFFEL TOWER" (also uppercases lowercase input); root flattened style width==1080 && height==1920.

---

## 5. Persistence

None in this slice. No keys, no stored JSON. Only network side effect is POST `/api/share/track` (with auth headers) and the tmp PNG file from capture. `isBranchEnabled` caches an env check in a module-level variable for process lifetime (`cachedEnabled`).

---

## 6. RevealAnimation test vectors (RevealAnimation.test.tsx → XCTest)

Fixture: 10 clusters `id:"c-1".."c-10"`, `canonical_text:"answer-1".."answer-10"`, `submission_count: 1000 - i*100`, `final_rank: i+1`, `final_pct_of_total: (1000-i*100)/5500`.
1. Renders `questionText` ("what's overrated?") immediately.
2. With NO questionId, `intervalMs=1` → after advancing timers 50 ms, `onComplete` called EXACTLY once (10 ticks + 2-tick hold = 12 ms). Confirms the hold scales with interval (2× interval, not fixed 2000 ms).
3. After completion, rank-1 `canonical_text` visible (verdict line "the world said — answer-1").

---

## 7. Surprising behaviors / edge cases (must replicate or consciously fix)

1. **All bubbles vanish at `done`** — the cloud clears (`visible = []`) the same tick the verdict line appears; it's not additive.
2. **Auto-advance only without questionId**; hold duration = `intervalMs * 2` (scales), not fixed 2000 ms.
3. **`userRank` uses array order, not `final_rank`** — `findIndex(...) + 1`. If caller ever passes unsorted clusters, rank is wrong. Also `(0)||null` coerces a not-found (−1) to null.
4. **trackShare failure aborts the whole share** — no PNG, no share sheet; callers just `console.warn` ("share failed" / "share verdict failed" / "share called-it failed"), no user-visible error UI.
5. **Sharing-availability check throws** `Error("Sharing not available on this device")` before anything else.
6. **shareUrl is dead weight in v1.0** — computed + returned, never shown/embedded; Branch is env-gated off (`EXPO_PUBLIC_BRANCH_KEY` empty) and its link function is a stub returning null even when enabled.
7. **Reveal-phase share cards carry `date=""` and handle `@anonymous`** — index.tsx passes neither `dateLabel` nor `selfHandle` to RevealAnimation.
8. **ArchiveDetail duplicates the verdict as satellite #1** — it passes ALL visibleClusters (rank 1 included) as `topClusters`, unlike RevealAnimation's `.slice(1, 7)`; ShareCardVerdict only does `.slice(0, 6)`.
9. **ArchiveDetail verdict card is always anonymous** (`userRank/percentile` hardcoded null → "sign in next time to claim a rank.").
10. **Offscreen capture pattern**: cards permanently mounted at (−10000, −10000) with opacity 0, `collapsable={false}` (RN view-flattening opt-out — irrelevant in SwiftUI but explains why views exist pre-tap). Capture options: PNG, quality 1, tmpfile.
11. **Number formatting is hard-locked to en-US** (`toLocaleString("en-US")` → "412,381") regardless of device locale; WordcloudScreen's own counter uses locale-default `toLocaleString()` — inconsistent by design.
12. **Star glyphs are text**: "★ I CALLED IT ★" and "★ SHARE — YOU CALLED IT" use U+2605, not an icon; separators are "·" (U+00B7) and "—" (em dash) and "•" (U+2022).
13. **called-it CTA gate**: crown button only if `selfClusterId` matches the rank-1 cluster id.
14. **WordcloudScreen share gate**: button + card render only when questionId && questionText && userAnswer && dateLabel all truthy; empty answer string kills sharing.

---

## 8. Verbatim string table

| String | Where |
|---|---|
| `the world said — {verdict}` | RevealAnimation verdict line |
| `SHARE THE VERDICT` | RevealAnimation CTA 1 |
| `★ SHARE — YOU CALLED IT` | RevealAnimation CTA 2 (calledIt only) |
| `continue →` | RevealAnimation CTA 3 |
| `SHARE` | ShareButton default label |
| `Share to…` | iOS share sheet dialogTitle |
| `Sharing not available on this device` | shareCardImage error |
| `share failed` / `share verdict failed` / `share called-it failed` | console.warn prefixes |
| `RELATABLY` | Verdict + TodaysTake card brand |
| `YESTERDAY · THE WORLD SAID —` | Verdict card strip |
| `I ranked #{n}. Better than {p}% of the world.` | Verdict card rank line |
| `sign in next time to claim a rank.` | Verdict card anonymous fallback |
| `★ I CALLED IT ★` | CalledIt badge |
| `• {n} of you agreed •` | CalledIt count line |
| `@anonymous` | CalledIt handle fallback |
| `RELATABLY · {date}` | CalledIt brand line |
| `your take —` (rendered `YOUR TAKE —` via uppercase transform) | TodaysTake label |
| `https://relatably.app/?r={referral_code}` | fallback share URL |
