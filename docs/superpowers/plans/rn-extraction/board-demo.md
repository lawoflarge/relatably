# Relatably — LeaderboardScreen ("the board"), LeaderboardRow, demoContent — 1:1 SwiftUI port spec

Source files (all under `/Users/levinschwab/Data/Claude/relatably/ios/`):
- `src/screens/LeaderboardScreen.tsx`
- `src/components/LeaderboardRow.tsx`
- `src/lib/demoContent.ts`
- Supporting: `src/theme/tokens.ts`, `src/lib/hiddenContentStore.ts`, `src/lib/api.ts` (fetchLeaderboard/blockUser/reportContent), `src/lib/deviceId.ts`, `src/components/icons/IconFlame.tsx`
- Tests: `src/screens/LeaderboardScreen.test.tsx`, `src/components/LeaderboardRow.test.tsx`

---

## 1. User-facing strings (VERBATIM — exact casing/punctuation)

### LeaderboardScreen
| String | Where |
|---|---|
| `the board ★` | Screen title (top of screen, left-aligned, lowercase with trailing star) |
| `DAILY` | Period pill 1 (key `daily`, default selected) |
| `WEEKLY` | Period pill 2 (key `weekly`) |
| `ALL-TIME` | Period pill 3 (key `alltime`) — note the hyphen |
| `GLOBAL` | Scope pill 1 (key `global`, default selected) |
| `FRIENDS` | Scope pill 2 (key `friends`; disabled unless signed in) |
| `sign in to see friend leaderboards` | Hint text above Sign-in-with-Apple button, only shown when NOT signed in |
| `sign in failed` | Alert TITLE when Apple sign-in errors (unless message matches /canceled/i) |
| `sign-in failed` | Fallback alert MESSAGE when the thrown error is not an `Error` instance (note hyphen; the title has a space) |
| `loading…` | Muted centered text while fetching (real ellipsis character `…`) |
| `no entries yet` | FlatList empty-state text (only visible when not loading and 0 rows) |

### LeaderboardRow
| String | Where |
|---|---|
| `anon` | Displayed handle when `handle == null` |
| `01`, `02`, … | Rank, always zero-padded to 2 digits: `String(rank).padStart(2, "0")` |
| `{streakDays}-DAY STREAK` | e.g. `12-DAY STREAK`; only rendered when `streakDays > 0`; preceded by flame icon |
| `★ #1` | Crown sticker tab text (only on `crown == true` row) |
| `YOU` | Self sticker tab text (only on `isSelf == true` row) |
| `⋯` | Moderation button glyph (U+22EF MIDLINE HORIZONTAL ELLIPSIS) shown when `canModerate` |
| `Cancel` | Action sheet option index 0 (cancel) |
| `Block this user` | Action sheet option index 1 (destructive) |
| `Report this user` | Action sheet option index 2 |
| (action sheet title) | The user's `displayHandle` |
| `Blocked` / `We won't show this user's content again.` | Alert title/message after successful block |
| `Couldn't block` | Alert title on block failure; message = `err.message` or `String(err)` |
| `Thanks for reporting` / `We'll review this account within 24 hours.` | Alert title/message after successful report |
| `Couldn't report` | Alert title on report failure; message = `err.message` or `String(err)` |

### Accessibility strings (LeaderboardRow)
- Row `accessibilityHint`: `Long-press to block or report this user` (only when `canModerate`)
- `⋯` button `accessibilityLabel`: `` `Block or report ${displayHandle}` `` → e.g. `Block or report maya`; `accessibilityRole="button"`; `hitSlop={8}`

---

## 2. Numeric constants

### Design tokens used (from `src/theme/tokens.ts`)
```
sp:    1:4  2:8  3:12  4:16  5:24  6:32  7:48  8:64  gutter:22  section:24
radii: s:14  m:22  l:28  xl:36  pill:999
shadow.s: color ink #1A1A1A, offset (2,2), radius 0, opacity 1, elevation 2   // hard offset "sticker" shadow, NO blur
shadow.m: color ink,          offset (4,4), radius 0, opacity 1, elevation 4
```

### LeaderboardScreen
| Value | Applies to |
|---|---|
| `insets.top + 32` (sp[6]) | Root paddingTop (safe-area top + 32) |
| 22 (sp.gutter) | Root paddingHorizontal |
| marginBottom 16 (sp[4]) | Title |
| gap 8 (sp[2]), marginBottom 12 (sp[3]) | periodRow AND scopeRow (horizontal rows of pills) |
| Pill: borderWidth 2, borderRadius 999, paddingHorizontal 12 (sp[3]), paddingVertical 8 (sp[2]), shadow.s | Period + scope pills |
| Pill text: fontSize 13, letterSpacing 0.6, opacity 1 active / 0.7 inactive | Pill labels |
| opacity 0.5 | FRIENDS pill when disabled (multiplies with the 0.7 text opacity from inactive state) |
| hint: fontSize 12 | "sign in to see friend leaderboards" |
| signInBlock: alignItems center, gap 12 (sp[3]), marginBottom 16 (sp[4]) | Sign-in block |
| muted: fontSize 14, padding 16 (sp[4]), textAlign center | "loading…" / "no entries yet" |
| `initialNumToRender={20}` | FlatList |
| `paddingBottom: 120` | FlatList contentContainerStyle |
| **11 / index 10** | Ad row is inserted at list index 10 iff `entries.length >= 11` (i.e. after the 10th entry) |

### LeaderboardRow
| Value | Applies to |
|---|---|
| outer: marginVertical 8 (sp[2]), position relative | Row wrapper Pressable |
| row: flexDirection row, alignItems center, gap 12 (sp[3]), paddingVertical 12 (sp[3]), paddingHorizontal 14 (sp[3]+2), borderRadius 22 (radii.m) | Card |
| borderWidth 3 if `isSelf || crown`, else 2 | Card border (color always ink) |
| shadow.m (offset 4,4) if `isSelf || crown`, else shadow.s (offset 2,2) | Card shadow |
| rank: fontSize 22, fixed width 32 | Rank text |
| avatar: 36×36, borderRadius 18, borderWidth 2 | Circle avatar |
| avatarInitial: fontSize 14 | Uppercased first char of handle (or `?` if empty string) |
| handle: fontSize 15, numberOfLines 1 | Handle |
| streakRow: gap 4, marginTop 2 | Flame + streak text row |
| flame icon: size 11 | IconFlame |
| streak text: fontSize 10, letterSpacing 1.2 | `N-DAY STREAK` |
| score: fontSize 20 | Score |
| modBtn: minWidth 36, minHeight 36, marginLeft 4 (sp[1]), centered | ⋯ button |
| modDots: fontSize 22, lineHeight 24 | ⋯ glyph |
| crown tab: absolute top −10, left −14, borderWidth 2, borderRadius 14 (radii.s), paddingHorizontal 8 (sp[2]), paddingVertical 2, **rotate −8deg** | `★ #1` sticker |
| crownText: fontSize 12 | |
| youTab: absolute top −12, right −10, borderWidth 2, borderRadius 14 (radii.s), paddingHorizontal 8 (sp[2]), paddingVertical 2, **rotate +4deg** | `YOU` sticker |
| youText: fontSize 10, letterSpacing 1.4 | |
| hitSlop 8 | ⋯ button |

### IconFlame (SVG, viewBox 0 0 24 24, no fill, strokeWidth 2, strokeLinejoin round)
```
Path: M12 3C12 8 17 9 17 14C17 17 14.8 20 12 20C9.2 20 7 17 7 14C7 11 9 10 9 7C10.5 8 12 7 12 3Z
```

---

## 3. Colors & fonts per element

Palette (tokens): `cream #FFF7E8`, `cream2 #FBEED1`, `ink #1A1A1A`, `inkSoft #4A4541`, `pink #FF4FA3`, `lemon2 #FFD43B`, `lemon #FFDF6B`, `mint #7AE6C3`, `blue #7BC8F6`, `red #FF5A4F`.

### Screen
- Root background: `palette.cream` (#FFF7E8), with `PaperTexture` overlay component behind everything.
- Title `the board ★`: font **BagelFatOne** 36/line 44 (typography.h2), color ink.
- Pills: background `palette.blue` (#7BC8F6) when active, `palette.cream` when inactive; border ink; text font **HankenGrotesk_700** (typography.body.family) size 13, color ink, letterSpacing 0.6.
- hint: font **SpaceGrotesk_600** (typography.label.family) size 12, color inkSoft.
- muted (`loading…` / `no entries yet`): **SpaceGrotesk_600** size 14, color inkSoft.

### Row (per-state color logic)
```ts
const bg = isSelf ? palette.pink : crown ? palette.lemon2 : "#FFFFFF";
const fg = isSelf ? palette.cream : palette.ink;
```
- Card: bg as above (self=pink #FF4FA3, crown=#FFD43B, else pure white #FFFFFF — NOT cream), border ink.
- Rank: **BagelFatOne** 22 (typography.h3.family), color `fg`.
- Avatar circle: background `palette.mint` (#7AE6C3), border ink 2; initial **BagelFatOne** 14, color ink (always ink, not fg).
- Handle: font literal **"HankenGrotesk_800"** 15, color `fg`.
- Streak: flame stroke color `fg`; text **SpaceGrotesk_700** (typography.micro.family) 10, color `fg`, letterSpacing 1.2.
- Score: **BagelFatOne** 20, color `fg`.
- ⋯: **BagelFatOne** 22/24, color `fg`.
- Crown tab: bg `palette.pink`, border ink; text **BagelFatOne** 12 color `palette.cream`.
- YOU tab: bg `palette.lemon2`, border ink; text **SpaceGrotesk_700** 10 color ink, letterSpacing 1.4.

Note: if a row is BOTH crown and self (rank 1 == you), `isSelf` wins for bg/fg (pink card, cream text), and BOTH stickers render (crown top-left AND YOU top-right).

---

## 4. Algorithms & state logic (verbatim TypeScript)

### 4.1 Screen state
```ts
const [period, setPeriod] = useState<LeaderboardPeriod>("daily");   // "daily" | "weekly" | "alltime"
const [scope, setScope] = useState<LeaderboardScope>("global");     // "global" | "friends"
const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
const [loading, setLoading] = useState(true);
const [authBump, setAuthBump] = useState(0);
const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
const effectiveSignedIn = isSignedIn || authBump > 0;
```
`authBump` is incremented by the inline SignInWithApple's `onSignedIn` so the screen flips to signed-in state without a prop update. Screen props: `{ isSignedIn: boolean; currentUserId?: string }`.

### 4.2 Fetch effect (re-runs on period OR scope change; cancellation flag)
```ts
useEffect(() => {
  let cancelled = false;
  setLoading(true);
  fetchLeaderboard({ period, scope })
    .then((res) => {
      if (cancelled) return;
      // Guideline 1.2 fallback: the global Board must never be empty, or a
      // reviewer has no user to block/report. (The server also backstops this.)
      if (res.entries.length === 0 && scope === "global") setEntries(DEMO_LEADERBOARD);
      else setEntries(res.entries);
    })
    .catch(() => { if (!cancelled) setEntries(scope === "global" ? DEMO_LEADERBOARD : []); })
    .finally(() => { if (!cancelled) setLoading(false); });
  return () => { cancelled = true; };
}, [period, scope]);
```

### 4.3 Blocked-ids load (once, on mount) + local filter + optimistic removal
```ts
useEffect(() => {
  let cancelled = false;
  getBlockedUserIds().then((ids) => {
    if (!cancelled) setBlockedIds(ids);
  });
  return () => { cancelled = true; };
}, []);

const visibleEntries = useMemo(
  () => entries.filter((e) => !blockedIds.has(e.user_id)),
  [entries, blockedIds],
);

const handleBlocked = (userId: string) => {
  setBlockedIds((prev) => {
    const next = new Set(prev);
    next.add(userId);
    return next;
  });
};
```

### 4.4 Ad interleave + rank derivation
```ts
type ListRow =
  | { kind: "entry"; entry: LeaderboardEntry; rank: number }
  | { kind: "ad"; key: "banner-row" };

function interleaveAd(entries: LeaderboardEntry[]): ListRow[] {
  const rows: ListRow[] = entries.map((entry, i) => ({
    kind: "entry" as const,
    entry,
    rank: entry.daily_rank ?? i + 1,
  }));
  if (entries.length >= 11) rows.splice(10, 0, { kind: "ad", key: "banner-row" });
  return rows;
}
```
Key points: rank comes from server `daily_rank` if present, else index+1 (of the FILTERED list — after blocking, ranks recompute only for entries lacking `daily_rank`). Interleave operates on `visibleEntries` (post-block-filter). Ad row renders `<BannerAdSlot slot="leaderboard_banner" />`. FlatList key: `r.kind === "ad" ? "banner-row" : r.entry.user_id`.

### 4.5 Row render params
```tsx
<LeaderboardRow
  rank={item.rank}
  userId={item.entry.user_id}
  handle={item.entry.handle}
  score={item.entry.score}
  streakDays={(item.entry as LeaderboardEntry & { streak_days?: number }).streak_days ?? 0}
  isSelf={!!currentUserId && item.entry.user_id === currentUserId}
  crown={item.rank === 1}
  onBlocked={handleBlocked}
/>
```
Note `crown` is `rank === 1` (rank, not index) — so it follows `daily_rank` if server sends it. `streak_days` is an OPTIONAL untyped extra on the entry; defaults 0.

### 4.6 Sign-in error handling
```tsx
<SignInWithApple
  onSignedIn={() => setAuthBump((n) => n + 1)}
  onError={(err) => {
    const msg = err instanceof Error ? err.message : "sign-in failed";
    if (!/canceled/i.test(msg)) Alert.alert("sign in failed", msg);
  }}
/>
```
User-cancel (any message containing "canceled", case-insensitive) is silently swallowed.

### 4.7 Row moderation logic (verbatim)
```ts
const displayHandle = handle ?? "anon";
const initial = (displayHandle[0] ?? "?").toUpperCase();
const canModerate = !!userId && !isSelf;

const doBlock = async () => {
  if (!userId) return;
  try {
    // Always record locally (works even when signed-out). Best-effort hit
    // the server endpoint — 401 for anonymous users is expected and ignored.
    await addBlockedUser({ user_id: userId, handle });
    try {
      await blockUser(userId);
    } catch {
      /* anonymous / network — local block still applies */
    }
    onBlocked?.(userId);
    Alert.alert("Blocked", "We won't show this user's content again.");
  } catch (err) {
    Alert.alert("Couldn't block", err instanceof Error ? err.message : String(err));
  }
};

const doReport = async () => {
  if (!userId) return;
  try {
    const deviceToken = await getDeviceToken();
    await reportContent({ target_type: "user", target_id: userId, device_token: deviceToken });
    Alert.alert("Thanks for reporting", "We'll review this account within 24 hours.");
  } catch (err) {
    Alert.alert("Couldn't report", err instanceof Error ? err.message : String(err));
  }
};

const handleLongPress = () => {
  if (!canModerate) return;
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: ["Cancel", "Block this user", "Report this user"],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 0,
        title: displayHandle,
      },
      (index) => {
        if (index === 1) doBlock();
        if (index === 2) doReport();
      },
    );
  } else { /* Android Alert path — irrelevant for SwiftUI */ }
};
```
Two entry points to the SAME action sheet: long-press anywhere on the row, and tap on the `⋯` button. Both gated by `canModerate = !!userId && !isSelf`.

### 4.8 API calls involved
```ts
// GET {BASE}/api/leaderboard?period={period}&scope={scope}[&limit=N]
// headers: auth token ONLY when scope === "friends"; global is unauthenticated
export async function fetchLeaderboard(opts: { period; scope; limit? }): Promise<{ entries: LeaderboardEntry[] }>

// POST {BASE}/api/users/{targetUserId}/block   (auth headers; throws `blockUser failed: {status}` on !ok)
// POST {BASE}/api/report  body: { target_type: "user", target_id, device_token }  (throws `report failed: {status}`)
```
`LeaderboardEntry = { user_id: string; handle: string | null; score: number; daily_rank?: number; locale: string }`.

---

## 5. Persistence keys & stored JSON shapes

From `src/lib/hiddenContentStore.ts` — **AsyncStorage** (deliberately NOT Keychain/SecureStore: iOS Keychain ~2KB/value limit; use UserDefaults or a file in SwiftUI):

- Key `"ugc_blocked_users_v1"` → JSON array, newest-first (unshift), dedup by `user_id`:
  ```json
  [{ "user_id": "demo-maya", "handle": "maya", "blocked_at": 1719900000000 }]
  ```
  (`blocked_at` = `Date.now()` epoch **milliseconds**; `handle` may be `null`.)
- Key `"ugc_hidden_clusters_v1"` → `[{ "id": string, "text": string, "hidden_at": number }]` (same semantics; used by wordcloud, not this screen).
- Read is defensive: missing key → `[]`; JSON parse error → `[]`; non-array → `[]`.
- From `src/lib/deviceId.ts` — **SecureStore (Keychain)** key `"relatably.device_token"` → string; on first use = identifierForVendor, fallback `` `anon-${Math.random().toString(36).slice(2) + Date.now().toString(36)}` ``.

---

## 6. Component tree / layout

```
View (flex1, bg cream #FFF7E8, paddingH 22, paddingTop safeTop+32)
├─ PaperTexture                      (full-bleed decorative overlay, behind content)
├─ Text "the board ★"                (BagelFatOne 36/44, ink, marginBottom 16)
├─ Row: period pills                 (hstack, gap 8, marginBottom 12)
│   ├─ pill DAILY  ├─ pill WEEKLY  └─ pill ALL-TIME
├─ Row: scope pills                  (hstack, gap 8, marginBottom 12)
│   ├─ pill GLOBAL  └─ pill FRIENDS  (opacity 0.5 + non-tappable when !effectiveSignedIn)
├─ [if !effectiveSignedIn] signInBlock (vstack centered, gap 12, marginBottom 16)
│   ├─ Text "sign in to see friend leaderboards" (SpaceGrotesk_600 12, inkSoft)
│   └─ SignInWithApple button
└─ [if loading] Text "loading…"  (centered, SpaceGrotesk_600 14, inkSoft, padding 16)
   [else] FlatList (contentPaddingBottom 120, initialNumToRender 20)
       ├─ LeaderboardRow ×N  (each: outer marginVertical 8 → net 16 between rows)
       ├─ BannerAdSlot slot="leaderboard_banner"  (inserted at index 10 iff ≥11 visible entries)
       └─ empty → Text "no entries yet"
```

Pill (both rows share the exact same style fn):
```
Pressable (bg active?blue:#FFF7E8, border ink 2, radius pill(999), padH 12, padV 8, shadow.s = hard 2,2 ink)
└─ Text LABEL (HankenGrotesk_700 13, ink, tracking 0.6, opacity active?1:0.7)
```

Row:
```
Pressable outer (relative, marginVertical 8, onLongPress → action sheet)
├─ View card (hstack center, gap 12, padV 12, padH 14, radius 22,
│             bg self?pink : crown?lemon2 : white, border ink 2 (3 if self/crown),
│             shadow s (m if self/crown) — hard offset, radius 0, opacity 1)
│   ├─ Text rank "01" (BagelFatOne 22, fg, fixed width 32)
│   ├─ View avatar (36Ø circle, mint bg, ink border 2)
│   │   └─ Text initial (BagelFatOne 14, ink)
│   ├─ View mid (flex 1)
│   │   ├─ Text handle (HankenGrotesk_800 15, fg, 1 line)
│   │   └─ [if streakDays>0] hstack (gap 4, marginTop 2): IconFlame(11, fg) + Text "N-DAY STREAK" (SpaceGrotesk_700 10, fg, tracking 1.2)
│   ├─ Text score (BagelFatOne 20, fg)
│   └─ [if canModerate] Pressable ⋯ (36×36 min, marginLeft 4, hitSlop 8)
├─ [if crown] View tab (absolute top −10 left −14, pink bg, ink border 2, radius 14, padH 8 padV 2, rotate −8°)
│   └─ Text "★ #1" (BagelFatOne 12, cream)
└─ [if isSelf] View tab (absolute top −12 right −10, lemon2 bg, ink border 2, radius 14, padH 8 padV 2, rotate +4°)
    └─ Text "YOU" (SpaceGrotesk_700 10, ink, tracking 1.4)
```

---

## 7. demoContent.ts — ENTIRE FILE VERBATIM

```ts
// Permanent reviewer / demo content for App Store Review Guideline 1.2 (client copy).
//
// Mirrors api/src/lib/demoContent.ts. Used as an OFFLINE / EMPTY fallback so the
// Board and the wordcloud are never blank for App Review — even if the backend is
// unreachable, or a brand-new daily drop has no answers yet. Without this, the
// reviewer can have nothing to hide / report / block, which is the exact reason
// Relatably kept getting rejected under Guideline 1.2.
//
// All entries are deliberately innocuous (coffee orders) so a reviewer can
// immediately exercise the moderation controls on real-looking, clearly
// non-objectionable content.

import type { LeaderboardEntry } from "@/src/types/api";
import type { Cluster } from "@/src/screens/WordcloudScreen";

export const DEMO_QUESTION = {
  id: "demo-reviewer-drop",
  text: "what's the most overrated coffee order?",
};

// 8 demo users for the Board. Stable user_ids so block/report can target them.
export const DEMO_LEADERBOARD: LeaderboardEntry[] = [
  { user_id: "demo-maya", handle: "maya", score: 1840, daily_rank: 1, locale: "en" },
  { user_id: "demo-leo", handle: "leo", score: 1620, daily_rank: 2, locale: "en" },
  { user_id: "demo-aisha", handle: "aisha", score: 1475, daily_rank: 3, locale: "en" },
  { user_id: "demo-theo", handle: "theo", score: 1290, daily_rank: 4, locale: "en" },
  { user_id: "demo-nina", handle: "nina", score: 1130, daily_rank: 5, locale: "en" },
  { user_id: "demo-omar", handle: "omar", score: 980, daily_rank: 6, locale: "en" },
  { user_id: "demo-ruby", handle: "ruby", score: 845, daily_rank: 7, locale: "en" },
  { user_id: "demo-kai", handle: "kai", score: 710, daily_rank: 8, locale: "en" },
];

const DEMO_CLUSTER_SEED: { id: string; canonical_text: string; submission_count: number }[] = [
  { id: "demo-cl-1", canonical_text: "pumpkin spice latte", submission_count: 47 },
  { id: "demo-cl-2", canonical_text: "caramel macchiato", submission_count: 39 },
  { id: "demo-cl-3", canonical_text: "frappuccino", submission_count: 31 },
  { id: "demo-cl-4", canonical_text: "flat white", submission_count: 24 },
  { id: "demo-cl-5", canonical_text: "matcha latte", submission_count: 19 },
  { id: "demo-cl-6", canonical_text: "cold brew", submission_count: 15 },
  { id: "demo-cl-7", canonical_text: "oat milk latte", submission_count: 12 },
  { id: "demo-cl-8", canonical_text: "espresso martini", submission_count: 9 },
  { id: "demo-cl-9", canonical_text: "chai latte", submission_count: 7 },
  { id: "demo-cl-10", canonical_text: "americano", submission_count: 5 },
];

const DEMO_TOTAL = DEMO_CLUSTER_SEED.reduce((s, c) => s + c.submission_count, 0);

// Wordcloud shape (Home).
export const DEMO_CLUSTERS: Cluster[] = DEMO_CLUSTER_SEED.map((c) => ({
  id: c.id,
  canonical_text: c.canonical_text,
  submission_count: c.submission_count,
}));

// Archive-detail shape (ranked list with percentages).
export const DEMO_ARCHIVE_CLUSTERS = DEMO_CLUSTER_SEED.map((c, i) => ({
  id: c.id,
  canonical_text: c.canonical_text,
  final_rank: i + 1,
  final_pct_of_total: c.submission_count / DEMO_TOTAL,
}));
```

Derived values for the port: `DEMO_TOTAL = 208`. `DEMO_ARCHIVE_CLUSTERS` percentages (exact fractions of 208): 47/208 ≈ 0.22596, 39/208 ≈ 0.18750, 31/208 ≈ 0.14904, 24/208 ≈ 0.11538, 19/208 ≈ 0.09135, 15/208 ≈ 0.07212, 12/208 ≈ 0.05769, 9/208 ≈ 0.04327, 7/208 ≈ 0.03365, 5/208 ≈ 0.02404 — keep these as computed fractions, not rounded literals. Demo handles have NO `@` prefix and NO `streak_days` field (so demo rows show no streak line).

---

## 8. Surprising behaviors / edge cases

1. **Demo fallback is scope-gated**: `DEMO_LEADERBOARD` is substituted (a) when the fetch SUCCEEDS with 0 entries AND scope is `global`, and (b) when the fetch THROWS and scope is `global`. For `friends` scope, empty/error → `[]` → shows `no entries yet`. This is the App-Review-Guideline-1.2 mechanism — must be preserved exactly.
2. **Blocking demo users works**: demo user_ids are stable so a reviewer can block `demo-maya` etc.; the block persists in `ugc_blocked_users_v1` and the filter then hides that demo row on every future load.
3. **Block flow is offline-first**: local `addBlockedUser` first (always), then server `blockUser` best-effort with errors swallowed (401 for anonymous users expected). Success alert fires even if the server call failed. Only a local-storage failure shows "Couldn't block".
4. **Report requires no sign-in** either: it sends the SecureStore `device_token` instead of user auth.
5. **Sign-in-cancel suppression**: sign-in errors matching `/canceled/i` show no alert (US spelling "canceled" — Apple's ASAuthorizationError.canceled message).
6. **FRIENDS pill when signed out** is disabled + opacity 0.5, but stays visible; tapping does nothing (`onPress` also guards on `effectiveSignedIn`).
7. **Rank vs index**: ranks display `daily_rank` from the server even for weekly/alltime periods (field name is `daily_rank` regardless). After a block, server-ranked entries keep their original numbers (gap appears, e.g. 01, 03…); entries without `daily_rank` renumber contiguously from filtered index.
8. **Ad row threshold**: inserted at index 10 only when ≥11 VISIBLE (post-block-filter) entries; the 8-entry demo board therefore never shows the inline banner. Uses the count BEFORE splice, so the ad appears between visible entry #10 and #11.
9. **Crown+self collision**: rank-1 self row gets pink/cream (self styling wins) but shows BOTH the `★ #1` tab (top-left, −8°) and `YOU` tab (top-right, +4°).
10. **Blocked-ids load once**: `getBlockedUserIds()` runs only on mount; blocks made elsewhere in the app during the session won't filter this screen until remount (plus the in-session `handleBlocked` optimistic add for blocks made on this screen).
11. **Loading state replaces the list entirely** (no skeleton, no pull-to-refresh, no pagination); every period/scope tap re-shows `loading…`.
12. **Shadows are hard-edged sticker shadows**: radius 0, opacity 1, ink color — in SwiftUI implement as an offset background/overlay shape, not `.shadow()` blur.
13. **`streak_days` is not in the `LeaderboardEntry` type** — it's read via a cast (`(entry as … & { streak_days?: number }).streak_days ?? 0`); treat as optional field in the Codable model.
14. **Avatar initial** uppercases the first character; `handle=null` → "anon" → initial "A"; empty-string handle → "?".
15. **`⋯` tap and row long-press are the only moderation affordances**; there is no swipe action.
16. **Global leaderboard fetch sends NO auth headers**; friends fetch awaits `authHeaders()`.

---

## 9. Test fixtures (from *.test.tsx — usable as XCTest vectors)

### LeaderboardScreen.test.tsx
- Mount with entries `[{u1, "@a", 1500, rank 1}, {u2, "@b", 1000, rank 2}]` → texts `@a` and `@b` render.
- Default fetch on mount is `{ period: "daily", scope: "global" }` (implied); pressing `ALL-TIME` → refetch with `period: "alltime"`.
- `isSignedIn=false` → text matching `/sign in to see friend leaderboards/i` present.
- 12 entries (`u-0…u-11`, handle `user{i}`, score `1000-i`, `daily_rank i+1`) → banner ad slot rendered (test asserts the disabled-ads placeholder testID `banner-ad-slot-disabled`).
- 5 entries → NO banner ad slot; `user0` renders.

### LeaderboardRow.test.tsx
- `rank=1, handle="ace.exe", score=1284, streakDays=12, isSelf=false, crown=true` → renders text `01` AND `★ #1`.
- `rank=2, handle=null, score=500, streakDays=0, crown=false` → renders `anon`.
- `rank=4, handle="levin", score=982, streakDays=4, isSelf=true, crown=false` → renders `YOU`.

---

## 10. Fonts required
- **BagelFatOne** (display: title, rank, score, avatar initial, crown text, ⋯). RN token comment: BagelFatOne has tall ascenders; line height needs ~1.2× size or glyph tops clip.
- **HankenGrotesk_700** (pill labels), **HankenGrotesk_800** (row handle).
- **SpaceGrotesk_600** (hint/muted labels), **SpaceGrotesk_700** (streak text, YOU text).
(Names are the Expo Google-Fonts PostScript-ish family keys; map to Hanken Grotesk Bold/ExtraBold and Space Grotesk SemiBold/Bold weights in SwiftUI.)
