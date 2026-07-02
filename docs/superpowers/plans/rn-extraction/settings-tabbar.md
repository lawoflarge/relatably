# Relatably — Settings screen + StickerTabBar + Tab layout (RN → SwiftUI extraction)

Source files read (paths relative to `/Users/levinschwab/Data/Claude/relatably/ios`):
- `app/(tabs)/settings.tsx` (entire)
- `components/StickerTabBar.tsx` (entire — NOTE: lives in `components/`, NOT `src/components/` as the task named it) + `components/StickerTabBar.test.tsx`
- `app/(tabs)/_layout.tsx` (entire)
- Supporting: `src/theme/tokens.ts`, `src/lib/hiddenContentStore.ts` (+ test), `src/components/sticker/PaperTexture.tsx`

---

## 0. Shared design tokens (`src/theme/tokens.ts`) — verbatim values

### palette
| token | hex |
|---|---|
| cream | `#FFF7E8` |
| cream2 | `#FBEED1` |
| ink | `#1A1A1A` |
| inkSoft | `#4A4541` |
| pink | `#FF4FA3` |
| lemon2 | `#FFD43B` |
| lemon | `#FFDF6B` |
| mint | `#7AE6C3` |
| blue | `#7BC8F6` |
| red | `#FF5A4F` |

### typography (size / lineHeight / family / letterSpacing)
| token | size | line | family | letterSpacing |
|---|---|---|---|---|
| hero | 52 | 62 | BagelFatOne | — |
| h1 | 40 | 48 | BagelFatOne | — |
| h2 | 36 | 44 | BagelFatOne | — |
| h3 | 22 | 28 | BagelFatOne | — |
| bodyL | 17 | 24 | HankenGrotesk_700 | — |
| body | 15 | 20 | HankenGrotesk_700 | — |
| bodyS | 13 | 18 | HankenGrotesk_700 | — |
| label | 11 | 14 | SpaceGrotesk_600 | 1.1 |
| micro | 9 | 12 | SpaceGrotesk_700 | 1.3 |

Source comment (important for iOS port): *"BagelFatOne is a tall, heavy-ascender display face. On iOS the line box is clamped to lineHeight, so a lineHeight <= fontSize clips the top of the glyphs. Display tokens therefore need headroom (~1.2x size)."*

### spacing `sp`
`1:4, 2:8, 3:12, 4:16, 5:24, 6:32, 7:48, 8:64, gutter:22, section:24`

### radii
`s:14, m:22, l:28, xl:36, pill:999`

### shadow (hard offset "sticker" shadows — radius 0, opacity 1, color = ink #1A1A1A)
| token | offset (w,h) | radius | opacity | elevation (Android) |
|---|---|---|---|---|
| s | 2, 2 | 0 | 1 | 2 |
| m | 4, 4 | 0 | 1 | 4 |
| l | 6, 6 | 0 | 1 | 6 |

### motion (ms; not used in these 3 files but part of token set)
`tap {120, ease-out}`, `spring {200, damping 0.5}`, `wobble {4000, range 2}`, `popIn {600, overshoot 1.08, stagger 25}`, `reveal {700, overshoot 1.15}`, `pulse {1800, scale 1.2}`

---

## 1. Tab layout — `app/(tabs)/_layout.tsx`

Tab order and expo-router titles (titles are set in options but the custom tab bar IGNORES them; see §2 LABELS):

| order | route name | options.title |
|---|---|---|
| 1 | `index` | `Today` |
| 2 | `friends` | `Friends` |
| 3 | `leaderboard` | `Board` |
| 4 | `archive` | `Archive` |
| 5 | `settings` | `Settings` |
| 6 | `archive/[id]` | `href: null` (hidden; pushed via router from ArchiveTab — a detail screen, NOT a tab) |

`screenOptions={{ headerShown: false }}`; custom tab bar: `tabBar={(props) => <StickerTabBar {...props} />}`.

---

## 2. StickerTabBar — `components/StickerTabBar.tsx`

### Verbatim glyphs and labels
```ts
const GLYPHS: Record<RouteName, string> = {
  index: "■",       // TODAY  (filled square — "drop")
  friends: "♥",     // FRIENDS
  leaderboard: "★", // BOARD
  archive: "▦",     // ARCHIVE (grid)
  settings: "⚙",    // SETTINGS (gear)
};

const LABELS: Record<RouteName, string> = {
  index: "TODAY",
  friends: "FRIENDS",
  leaderboard: "BOARD",
  archive: "ARCHIVE",
  settings: "ME",
};
```
Fallbacks when a route is not in the maps: glyph `"•"`, label `route.name.toUpperCase()`.
NOTE: settings tab shows label **ME** (not "SETTINGS") with a gear glyph, even though the router title is "Settings".

### Route whitelist (verbatim, incl. rationale comment)
```ts
// Whitelist of routes that get a tab pill. Expo-router auto-discovers
// every file in (tabs)/ including the nested archive/[id] dynamic route,
// and `<Tabs.Screen options={{ href: null }} />` only suppresses items
// from the DEFAULT React Navigation tab bar — custom tab bars (this
// component) get every route in state.routes regardless. Build 25
// shipped with archive/[id] visible as a phantom "ARCHIVE/[ID]" tab.
const VISIBLE: ReadonlySet<RouteName> = new Set([
  "index",
  "friends",
  "leaderboard",
  "archive",
  "settings",
]);
```

### Render/selection logic (verbatim)
```tsx
export function StickerTabBar({ state, navigation, insets }: Props) {
  // Tighter bottom padding so the pill hugs the home indicator instead of
  // floating with a goofy 30-40pt cream gap below it (build 25 issue).
  // Home indicator is ~34pt; keep ~8pt clearance so the gesture handle
  // doesn't visually overlap the pill border.
  const bottomPad = insets.bottom > 0 ? 8 : 12;
  return (
    <View style={[styles.outer, { paddingBottom: bottomPad }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes
          .map((route, i) => ({ route, originalIndex: i }))
          .filter(({ route }) => VISIBLE.has(route.name as RouteName))
          .map(({ route, originalIndex }) => {
            const i = originalIndex;
            const name = route.name as RouteName;
            const isActive = state.index === i;
            const glyph = GLYPHS[name] ?? "•";
            const label = LABELS[name] ?? route.name.toUpperCase();
            return (
            <Pressable
              key={route.key}
              role="button"
              onPress={() => {
                if (!isActive) {
                  try { Haptics.selectionAsync().catch(() => {}); } catch { /* noop */ }
                  navigation.navigate(name);
                }
              }}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Text style={[styles.glyph, { color: isActive ? palette.cream : palette.ink }]}>{glyph}</Text>
              <Text style={[styles.label, { color: isActive ? palette.cream : palette.ink }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
```
Behavioral notes:
- Haptic: `Haptics.selectionAsync()` (iOS = UISelectionFeedbackGenerator.selectionChanged()), fired ONLY when pressing a non-active tab; both sync throw and async rejection are swallowed.
- Pressing the already-active tab does NOTHING (no re-navigate, no scroll-to-top, no haptic).
- Never emits `tabPress` events to listeners (navigation.emit exists in Props type but is unused).
- Active state matched against the route's ORIGINAL index in `state.routes` (correct because hidden `archive/[id]` sorts last), not the filtered index.

### StickerTabBar layout constants (verbatim styles)
```ts
const styles = StyleSheet.create({
  outer: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", paddingHorizontal: sp.gutter },
  bar: {
    flexDirection: "row",
    backgroundColor: palette.cream,
    borderColor: palette.ink,
    borderWidth: 3,
    borderRadius: radii.pill,
    paddingHorizontal: sp[1],
    paddingVertical: sp[1],
    gap: sp[1],
    shadowColor: shadow.m.color,
    shadowOffset: shadow.m.offset,
    shadowRadius: shadow.m.radius,
    shadowOpacity: shadow.m.opacity,
    elevation: shadow.m.elevation,
  },
  tab: { paddingHorizontal: sp[3], paddingVertical: sp[2], borderRadius: radii.pill, alignItems: "center", gap: 2, minWidth: 64 },
  tabActive: { backgroundColor: palette.ink },
  glyph: { fontSize: 18, lineHeight: 20 },
  label: { fontFamily: typography.micro.family, fontSize: typography.micro.size, letterSpacing: 1.3 },
});
```
Resolved numbers:
- Container: absolute-positioned overlay at screen bottom, horizontally centered content, horizontal inset 22pt; bottom padding = **8pt if safe-area bottom > 0, else 12pt** (i.e. pill sits ~8pt above home indicator).
- Pill bar: cream `#FFF7E8` bg, 3pt ink border, fully-rounded (pill), inner padding 4pt all around, 4pt gap between tabs, hard shadow m (ink, offset 4,4, radius 0, opacity 1).
- Tab item: paddingH 12, paddingV 8, pill radius, centered column, 2pt gap glyph→label, minWidth 64pt.
- Active tab: ink `#1A1A1A` background; glyph+label color flips to cream `#FFF7E8`. Inactive: transparent bg, ink text.
- Glyph: system font (no family set), fontSize 18, lineHeight 20. Label: SpaceGrotesk_700, 9pt, letterSpacing 1.3 (uppercase strings baked in).
- `pointerEvents="box-none"` on outer → touches outside the pill pass through to content beneath.

### Why unicode glyphs (verbatim comment — port note: use SF Symbols or keep glyphs)
```ts
// Unicode glyphs instead of react-native-svg icons. The svg package
// downgrade (15.15 -> 15.12 to match Expo SDK 54) was leaving one of
// the IconHome/Friends/Board/Archive imports as undefined at runtime,
// which crashed StickerTabBar with "Element type is invalid... got:
// undefined". Glyphs render via plain <Text> -> zero native deps.
```

---

## 3. Settings screen — `app/(tabs)/settings.tsx`

### Constants
```ts
const BASE = process.env.EXPO_PUBLIC_API_URL ?? "https://relatably.vercel.app";
const SUPPORT_EMAIL = "levin.schwab@gmx.de";
```

### 3.1 ALL user-facing strings VERBATIM

Screen chrome:
- Title (h1): `Settings`
- Footer (centered, bodyS, inkSoft): `© 2026 Levin Schwab · v1.0`  (middle dot `·`; version hardcoded)
- Row chevron glyph: `›` ; unhide/unblock rows use `×` instead.

Static links card (4 rows, in order):
| label | hint (sub-line) | action |
|---|---|---|
| `Contact support` | `levin.schwab@gmx.de` (SUPPORT_EMAIL) | mailto, subject `Relatably support` |
| `Report inappropriate content` | `We act within 24 hours` | mailto, subject `Report inappropriate content / abusive user on Relatably`, body `Please describe what you'd like to report. We respond within 24 hours.\n\n` |
| `Terms of Service` | — | open `${BASE}/tos` → `https://relatably.vercel.app/tos` |
| `Privacy Policy` | — | open `${BASE}/privacy` → `https://relatably.vercel.app/privacy` |

Section headers (label typography, uppercase already in string):
- `HIDDEN ANSWERS` (only when ≥1 hidden cluster)
- `BLOCKED USERS` (only when ≥1 blocked user)
- `ACCOUNT` (only when signed in, uid != null)

Hidden-answer row: label = `“{text}”` (typographic double quotes `&ldquo;`/`&rdquo;` around cluster text, `numberOfLines={1}` → single line, truncating), hint `Tap to unhide`, accessibility label `Unhide "{text}"`.
Blocked-user row: label = `handle ?? "@" + user_id.slice(0, 6)` (i.e. `@` + first 6 chars of user_id when no handle), hint `Tap to unblock`, accessibility label `Unblock {display}`.

ACCOUNT card rows:
- Row 1: label `Sign out`, hint `Stay anonymous on this device`, chevron `›`.
- Row 2 (destructive, red `#FF5A4F` label + chevron): label `Delete account` (while busy: `Deleting…` — U+2026 ellipsis), hint `Permanent. Can't be undone.` (rendered from `Can&apos;t`), accessibility label `Delete account`, disabled while busy.

Signed-out hint (replaces ACCOUNT section when uid == null; plain text, no card):
`You're playing anonymously. Sign in with Apple from the Friends tab to unlock the leaderboard.`

Alerts (title, message, buttons — verbatim):
1. Link error: title `Couldn't open link`, message = error message string. (single OK)
2. Mail error (contact): title `Couldn't open mail`, message = error message string.
3. Report-mail fallback: title `Mail unavailable`, message `Please email levin.schwab@gmx.de from any email app. We respond within 24 hours.`
4. Sign-out confirm: title `Sign out?`, message `Your device will go back to anonymous mode. Your data on the server stays put.`, buttons: `Cancel` (cancel style) / `Sign out` (destructive).
5. Sign-out error: title `Couldn't sign out`, message = error message string.
6. Delete confirm: title `Delete your account?`, message `This permanently removes your profile, leaderboard entries, and friend graph, and revokes your Sign in with Apple link to Relatably. Past answers are anonymised but stay in the wordcloud. This can't be undone.`, buttons: `Cancel` (cancel) / `Delete account` (destructive).
7. Delete success: title `Account deleted`, message `Your account and personal data have been removed from Relatably.`
8. Delete error: title `Couldn't delete account`, message = error message if Error, else `please try again or email levin.schwab@gmx.de` (lowercase "please", string concat `"please try again or email " + SUPPORT_EMAIL`).

### 3.2 State & effects (verbatim)
```ts
const [uid, setUid] = useState<string | null>(null);
const [busy, setBusy] = useState(false);
const [hidden, setHidden] = useState<HiddenCluster[]>([]);
const [blocked, setBlocked] = useState<BlockedUser[]>([]);

useEffect(() => {
  const unsub = onAuthStateChanged(auth(), (u) => setUid(u?.uid ?? null));
  return () => unsub();
}, []);

useEffect(() => {
  let cancelled = false;
  Promise.all([getHiddenClusters(), getBlockedUsers()]).then(([h, b]) => {
    if (cancelled) return;
    setHidden(h);
    setBlocked(b);
  });
  return () => { cancelled = true; };
}, []);
```
Note: hidden/blocked lists load ONCE on mount (not on tab re-focus). If the user hides/blocks something elsewhere while this screen stays mounted in the tab stack, the list is stale until remount.

Unhide/unblock handlers (optimistic local removal after await):
```ts
const handleUnhide = useCallback(async (id: string) => {
  await unhideCluster(id);
  setHidden((prev) => prev.filter((h) => h.id !== id));
}, []);

const handleUnblock = useCallback(async (userId: string) => {
  await removeBlockedUser(userId);
  setBlocked((prev) => prev.filter((b) => b.user_id !== userId));
}, []);
```

Link/mail openers (verbatim):
```ts
const open = (url: string) => () => {
  Linking.openURL(url).catch((err) => {
    Alert.alert("Couldn't open link", err instanceof Error ? err.message : String(err));
  });
};

const handleContact = () => {
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Relatably support")}`;
  Linking.openURL(url).catch((err) => {
    Alert.alert("Couldn't open mail", err instanceof Error ? err.message : String(err));
  });
};

const handleReportInappropriate = () => {
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Report inappropriate content / abusive user on Relatably")}&body=${encodeURIComponent(
    "Please describe what you'd like to report. We respond within 24 hours.\n\n",
  )}`;
  Linking.openURL(url).catch(() => {
    Alert.alert(
      "Mail unavailable",
      `Please email ${SUPPORT_EMAIL} from any email app. We respond within 24 hours.`,
    );
  });
};
```

Delete-account flow (verbatim — order matters: server delete → signOut (errors swallowed) → success alert; busy gate):
```ts
const handleDeleteAccount = useCallback(() => {
  Alert.alert(
    "Delete your account?",
    "This permanently removes your profile, leaderboard entries, and friend graph, and revokes your Sign in with Apple link to Relatably. Past answers are anonymised but stay in the wordcloud. This can't be undone.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete account",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await deleteAccount();
            try {
              await signOut();
            } catch {
              /* already-deleted -> fine */
            }
            Alert.alert("Account deleted", "Your account and personal data have been removed from Relatably.");
          } catch (err) {
            Alert.alert(
              "Couldn't delete account",
              err instanceof Error ? err.message : "please try again or email " + SUPPORT_EMAIL,
            );
          } finally {
            setBusy(false);
          }
        },
      },
    ],
  );
}, []);
```

### 3.3 Layout / component tree
```
View (root: flex 1, bg cream #FFF7E8)
├─ StatusBar style="dark" (dark status-bar content on light bg)
├─ PaperTexture (full-screen, non-interactive dot grid — see §5)
└─ ScrollView contentContainer:
   paddingHorizontal 22 (sp.gutter), paddingBottom 120, gap 16 (sp[4]) between children,
   paddingTop = safeAreaInsets.top + 24 (sp[5])
   ├─ Text "Settings"        — BagelFatOne 40/48, ink, marginBottom 8
   ├─ Card (links, 4 rows)
   ├─ [if hidden.length>0]  Text "HIDDEN ANSWERS" (section label) + Card(hidden rows)
   ├─ [if blocked.length>0] Text "BLOCKED USERS"  (section label) + Card(blocked rows)
   ├─ [if uid] Text "ACCOUNT" + Card(Sign out / Delete account)
   │  [else]  View signedOutHint (paddingH 8, paddingV 8) → Text (rowHint style) anonymous message
   └─ Text footer "© 2026 Levin Schwab · v1.0" — marginTop 24, centered, bodyS 13, inkSoft
```

Card style: white `#FFFFFF` bg, 3pt ink border, radius 22 (radii.m), hard shadow s (ink, offset 2,2, radius 0, opacity 1).
Row: horizontal, vertically centered, paddingH 16, paddingV 16 (sp[4]); every row except last in a card has bottom divider: ink, 2pt.
Row internals: `View {flex:1}` containing label (bodyL: HankenGrotesk_700 17pt, ink) + optional hint (bodyS: HankenGrotesk_700 13pt, inkSoft `#4A4541`, marginTop 2). Trailing chevron Text: BagelFatOne (h2 family) fontSize 24, ink, marginLeft 8.
Section label style: marginTop 8, SpaceGrotesk_600 11pt, letterSpacing 1.4 (NOTE: overrides token 1.1), inkSoft.
Destructive label/chevron color: red `#FF5A4F`.
All rows are Pressable with `accessibilityRole="button"` (no pressed-state visual defined — default opacity behavior only; Pressable has no style feedback here).

### 3.4 Numeric constants summary (Settings)
| value | applies to |
|---|---|
| 22 | screen horizontal gutter (sp.gutter) |
| insets.top + 24 | scroll content top padding |
| 120 | scroll content bottom padding (clears floating tab pill) |
| 16 | vertical gap between scroll children; row padding H+V |
| 8 | title marginBottom; section-label marginTop; chevron marginLeft; signedOutHint padding |
| 24 | footer marginTop; chevron fontSize |
| 3 | card borderWidth |
| 2 | row divider height; hint marginTop; card shadow offset |
| 22 | card cornerRadius (radii.m) |
| 11 / 1.4 | section label size / letterSpacing |
| 1 | numberOfLines for hidden-answer text |
| 6 | user_id prefix length for fallback handle |

---

## 4. Persistence — `src/lib/hiddenContentStore.ts`

Storage: AsyncStorage (iOS: use UserDefaults or file-backed store). Verbatim rationale comment: *"AsyncStorage (not SecureStore) because Keychain has a ~2KB-per-value limit on iOS that can fail for power users."*

Keys:
- `ugc_hidden_clusters_v1` → JSON array of `{ "id": string, "text": string, "hidden_at": number }` (`hidden_at` = `Date.now()` epoch **milliseconds**)
- `ugc_blocked_users_v1` → JSON array of `{ "user_id": string, "handle": string | null, "blocked_at": number }` (epoch ms)

Semantics (all verbatim-equivalent, full file logic):
- `readJson`: missing key → `[]`; JSON parse error → `[]`; parsed non-array → `[]`.
- `hideCluster({id,text})` / `addBlockedUser({user_id,handle})`: **idempotent** by id — if id already present, no-op (does NOT update text/handle/timestamp); otherwise `unshift` (newest **first** in array).
- `unhideCluster(id)` / `removeBlockedUser(user_id)`: filter-out and rewrite whole array.
- `getHiddenClusterIds()` / `getBlockedUserIds()` return `Set<string>` of ids (used elsewhere for feed filtering).

---

## 5. PaperTexture — `src/components/sticker/PaperTexture.tsx` (used as Settings background)

Full-screen, `pointerEvents="none"`, absolute-fill overlay. SVG sized to window width×height, whole-SVG **opacity 0.06**. Pattern: 12×12 pt repeating tile (`patternUnits="userSpaceOnUse"`), each tile containing one circle at cx=1, cy=1, r=1, fill ink `#1A1A1A`. A rect covering the window is filled with the pattern. SwiftUI equivalent: tiled 12×12 dot image or Canvas, at 6% opacity, ink dots of radius 1 offset (1,1) in each tile.

---

## 6. Test vectors (from `components/StickerTabBar.test.tsx` and `src/lib/hiddenContentStore.test.ts`) — usable as XCTest fixtures

StickerTabBar:
- Given routes `[index, friends, leaderboard, archive]`, selectedIndex 0, insets.bottom 30 → renders exactly labels `TODAY`, `FRIENDS`, `BOARD`, `ARCHIVE`.
- Press `FRIENDS` while index active → `navigate("friends")` called once. (Implicit from source: pressing active tab → no navigate, no haptic.)

hiddenContentStore:
- Fresh store → `getHiddenClusters() == []`, `getHiddenClusterIds() == {}` (empty set).
- `hideCluster({id:"c1", text:"AI"})` → list length 1, `[0].id=="c1"`, `[0].text=="AI"`, `hidden_at` is number.
- `hideCluster(c1)` twice → length stays 1 (idempotent).
- hide c1 ("AI") + c2 ("Bitcoin") → ids contains c1,c2; not c3.
- then `unhideCluster("c1")` → ids: c1 absent, c2 present.
- `addBlockedUser({user_id:"u1", handle:"alice"})` → length 1, user_id "u1", handle "alice", `blocked_at` number.
- `addBlockedUser({user_id:"u1", handle:null})` → `handle == nil` preserved.
- addBlockedUser twice same id → length 1.
- block u1(alice)+u2(bob), `removeBlockedUser("u1")` → ids: u1 absent, u2 present.

---

## 7. Surprising behaviors / port red flags

1. **Tab label mismatch**: router titles ("Today"/"Friends"/"Board"/"Archive"/"Settings") are never displayed; the tab bar hardcodes `TODAY/FRIENDS/BOARD/ARCHIVE/ME`. Settings tab reads **ME**.
2. **`archive/[id]` phantom-tab lesson**: any non-tab route must be excluded from the tab bar via whitelist; in SwiftUI TabView this is moot (use NavigationStack push for archive detail), but preserve the 5-tab set exactly.
3. **Active-tab tap is a no-op** — no pop-to-root/scroll-to-top. Default SwiftUI TabView pops to root on re-tap; suppress to match 1:1 (or consciously deviate).
4. **Haptics only on tab switch**, `selection` style, errors swallowed.
5. **Settings lists load once on mount**; no focus-refresh. SwiftUI `.onAppear` firing on every tab switch would be a behavior CHANGE (arguably a fix) — flag for decision.
6. **Delete-account edge**: `signOut()` failure after successful server delete is silently ignored (`/* already-deleted -> fine */`); success alert still shows; `busy` gate disables the row and swaps label to `Deleting…`.
7. **Error-message casing quirk**: delete-error fallback message starts lowercase: `please try again or email levin.schwab@gmx.de`.
8. **Hard shadows**: shadowRadius 0 / opacity 1 → crisp offset "sticker" shadow, NOT a blur. In SwiftUI use `.shadow(color: ink, radius: 0, x: 2, y: 2)` (card) / `(x:4, y:4)` (tab pill) or a background offset shape.
9. **Section-label letterSpacing 1.4 on Settings overrides the token's 1.1.**
10. **Typographic quotes**: hidden-answer rows wrap text in `“ ”` (U+201C/U+201D), not straight quotes.
11. **`BASE` is env-overridable** (`EXPO_PUBLIC_API_URL`), default `https://relatably.vercel.app`; ToS/Privacy = `/tos`, `/privacy`.
12. **Footer version hardcoded** `v1.0` (not read from bundle); decide whether to bind to CFBundleShortVersionString.
13. **Fonts**: BagelFatOne, HankenGrotesk (700), SpaceGrotesk (600/700) — custom fonts must be bundled; note lineHeight-headroom comment for BagelFatOne on iOS.
14. **Tab bar floats over content** (absolute overlay, box-none) — content scrolls beneath it; Settings compensates with paddingBottom 120.
15. **Sign-out semantics**: signing out returns device to **anonymous mode** (Firebase anon auth) — not a logged-out wall.
