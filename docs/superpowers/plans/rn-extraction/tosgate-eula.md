# TosGate + eulaStore — 1:1 SwiftUI Port Spec

Sources (verbatim, complete extraction):
- `/Users/levinschwab/Data/Claude/relatably/ios/src/components/TosGate.tsx` (127 lines)
- `/Users/levinschwab/Data/Claude/relatably/ios/src/lib/eulaStore.ts` (16 lines)
- Token values resolved from `/Users/levinschwab/Data/Claude/relatably/ios/src/theme/tokens.ts`
- Mounting point: `/Users/levinschwab/Data/Claude/relatably/ios/app/_layout.tsx`

No test files exist for either file (verified via repo-wide grep for `TosGate|eulaStore|tos_accepted`).

---

## 1. Purpose (from the source doc comment, load-bearing for review compliance)

Verbatim comment in `TosGate.tsx`:

```
App Review Guideline 1.2 requires UGC apps to make users agree to terms
that prohibit objectionable content. This gate renders a full-screen
acceptance modal the first time the app is launched (and again whenever
CURRENT_TOS_VERSION in eulaStore.ts bumps).

Acceptance is recorded with expo-secure-store so it persists across
launches and is per-device (not per-user — anonymous users also need
to agree).
```

SwiftUI equivalent of expo-secure-store = **iOS Keychain** (per-device, survives reinstall on iOS by default in Keychain unless entitlements say otherwise; RN expo-secure-store on iOS is Keychain `kSecClassGenericPassword`).

---

## 2. ALL user-facing strings VERBATIM

| # | String (exact, incl. casing/punctuation) | Where |
|---|---|---|
| 1 | `loading…` | Loading phase, single centered text (note: ellipsis character `…`, lowercase) |
| 2 | `Before you play` | Title (h1) at top of blocking screen |
| 3 | `Relatably is a daily question app. Anyone can submit an answer, so we have a zero-tolerance rule about what you write:` | First body paragraph (renders as one wrapped paragraph; the RN source has a line break inside the JSX which collapses to a single space) |
| 4 | `•` | Bullet glyph, one per bullet row (literal bullet character, own Text element, 14pt-wide centered column) |
| 5 | `No hate, harassment, threats, or slurs.` | Bullet 1 text |
| 6 | `No sexual content involving minors. Ever.` | Bullet 2 text |
| 7 | `No personal info about other people.` | Bullet 3 text |
| 8 | `No spam, scams, or attempts to game the wordcloud.` | Bullet 4 text |
| 9 | `Anything else? Tap any answer in the wordcloud to hide it, report it, or block whoever wrote it. We act on reports within 24 hours and eject repeat offenders.` | Second body paragraph (again one wrapped paragraph) |
| 10 | `By tapping I AGREE you confirm you're 18 or older and you accept our Terms of Service and Privacy Policy.` | Fine-print paragraph. Mixed inline styling — see §2.1. Note the apostrophe in source is `you&apos;re` → renders as straight apostrophe `you're`. Ends with a period after "Privacy Policy". |
| 11 | `I AGREE` | Button caption (all caps) |
| 12 | `I agree to the terms` | Accessibility label of the button (`accessibilityRole="button"`) — in SwiftUI: `.accessibilityLabel("I agree to the terms")` on the button. |

### 2.1 Inline styling inside the fine-print paragraph (#10)

The paragraph is one flowing Text (styled `smaller`) with three inline spans:

- `I AGREE` — inline span with `fontFamily: typography.label.family` = **SpaceGrotesk_600** (font family only is overridden; size/line/color inherit from `smaller`, i.e. 13pt, inkSoft). No letterSpacing applied to this inline span (only family is set).
- `Terms of Service` — tappable link span, style `link`: color **ink `#1A1A1A`**, `textDecorationLine: "underline"`. Tap opens URL `{BASE}/tos` in external browser (`Linking.openURL`).
- `Privacy Policy` — tappable link span, same `link` style. Tap opens `{BASE}/privacy`.

Literal text around the spans (spaces are explicit `{' '}` in JSX):
`By tapping ` + **I AGREE** + ` you confirm you're 18 or older and you accept our ` + **Terms of Service** + ` and ` + **Privacy Policy** + `.`

### 2.2 Link URLs

```
const BASE = process.env.EXPO_PUBLIC_API_URL ?? "https://relatably.vercel.app";
```

- Terms of Service → `https://relatably.vercel.app/tos`
- Privacy Policy → `https://relatably.vercel.app/privacy`

No `.env` / `app.config` in the repo sets `EXPO_PUBLIC_API_URL` (verified), so the fallback URL is the effective value. In Swift, hardcode base `https://relatably.vercel.app` (or read from Info.plist config if the port has one) and open with `UIApplication.shared.open` / `Link`.

---

## 3. Numeric constants

### 3.1 Layout / spacing (token → px value → applies to)

| Token | Value | Applied to |
|---|---|---|
| `sp[8]` | 64 | ScrollView content `paddingTop` AND `paddingBottom` |
| `sp.gutter` | 22 | ScrollView content `paddingHorizontal` |
| `sp[3]` | 12 | `gap` between ALL stacked children of the scroll content (VStack spacing) |
| `sp[2]` | 8 | `title` `marginBottom` (extra, additive on top of the 12 gap → effective 20 between title and first body); ALSO `gap` between bullet glyph and bullet text inside each bullet row |
| `sp[3]` | 12 | `smaller` (fine print) `marginTop` (additive on top of 12 gap → effective 24 above fine print) |
| `sp[5]` | 24 | `agreeBtn` `marginTop` (additive on top of 12 gap → effective 36 above button) |
| `sp[6]` | 32 | `agreeBtn` `paddingHorizontal` |
| `sp[3]` | 12 | `agreeBtn` `paddingVertical` |
| — | 14 | Fixed `width` of the bullet glyph Text, `textAlign: "center"` |
| `radii.pill` | 999 | `agreeBtn` `borderRadius` (SwiftUI: `Capsule()`) |
| — | 3 | `agreeBtn` `borderWidth` |

### 3.2 Shadow (token `shadow.s` — "sticker" hard shadow, NOT a blur)

| Property | Value |
|---|---|
| color | `palette.ink` = `#1A1A1A` |
| offset | width 2, height 2 |
| radius (blur) | **0** — hard-edged offset shadow |
| opacity | 1 |
| elevation (Android only) | 2 — irrelevant for iOS port |

SwiftUI: `.shadow(color: Color(hex: 0x1A1A1A), radius: 0, x: 2, y: 2)` on the button (applied to the capsule background including its border).

### 3.3 Typography numbers

| Element | Font family | Size | Line height | Letter spacing |
|---|---|---|---|---|
| `loadingText` | HankenGrotesk_700 (typography.bodyS.family) | **14** (hardcoded, NOT bodyS.size 13) | none set (RN default) | — |
| `title` (h1 token) | BagelFatOne | 40 | 48 | — |
| `body` paragraphs (bodyL token) | HankenGrotesk_700 | 17 | 24 | — |
| `bullet` glyph (bodyL family/size) | HankenGrotesk_700 | 17 | **no lineHeight set** | — |
| `bulletText` (bodyL token) | HankenGrotesk_700 | 17 | 24 | — |
| `smaller` (bodyS token) | HankenGrotesk_700 | 13 | 18 | — |
| `agreeText` | SpaceGrotesk_600 (typography.label.family) | **14** (hardcoded, NOT label.size 11) | none set | **1.4** (hardcoded, NOT label token's 1.1) |
| inline `I AGREE` in fine print | SpaceGrotesk_600 | inherits 13 | inherits 18 | none |

Font-family note (from tokens.ts comment, relevant to line-height choices): BagelFatOne is a tall heavy-ascender display face; lineHeight ≤ fontSize clips glyph tops on iOS, hence h1 uses 48/40 (~1.2x). Preserve 48pt line height in SwiftUI (e.g. fixed `lineSpacing`/`lineHeight` via `.font` + `.lineSpacing(8)` or UIFont line-height override).

### 3.4 No timings

No animations, no timers, no character limits in these files. The `motion` tokens exist in tokens.ts but are NOT used by TosGate.

---

## 4. Colors per element (token → hex)

| Token | Hex | Used on |
|---|---|---|
| `palette.cream` | `#FFF7E8` | Loading screen background; blocking screen background (`root`); `agreeText` button caption color |
| `palette.ink` | `#1A1A1A` | Title, body paragraphs, bullet glyph, bullet text, link text, button border, button shadow color |
| `palette.inkSoft` | `#4A4541` | `loadingText`, `smaller` fine print |
| `palette.pink` | `#FF4FA3` | `agreeBtn` background fill |

---

## 5. State logic & algorithms (verbatim)

### 5.1 Phase state machine

```ts
type Phase = "loading" | "blocking" | "ready";
```

```ts
const [phase, setPhase] = useState<Phase>("loading");

useEffect(() => {
  (async () => {
    try {
      const accepted = await hasAcceptedTos();
      setPhase(accepted ? "ready" : "blocking");
    } catch {
      // SecureStore unavailable — fail open and let the user in.
      setPhase("ready");
    }
  })();
}, []);
```

- Initial phase: `loading` (renders minimal "loading…" screen, cream bg).
- On mount (once): read keychain. Accepted → `ready` (render children = whole app). Not accepted → `blocking` (full-screen gate). **Any error reading storage → `ready` (fail-open).**
- Button press handler:

```ts
onPress={async () => {
  await recordTosAcceptance();
  setPhase("ready");
}}
```

Note: `recordTosAcceptance()` is awaited and NOT wrapped in try/catch — if the keychain write throws, the promise rejects and `setPhase("ready")` never runs (user stays on the gate; RN surfaces an unhandled rejection warning only). A strict 1:1 port would let a Keychain write error keep the gate up; a pragmatic port may choose to fail open here too — flag to the caller.

- `ready` renders `<>{children}</>` — children are the app's root navigation stack.

### 5.2 eulaStore — entire file verbatim

```ts
import * as SecureStore from "expo-secure-store";

const KEY = "tos_accepted_version";

// Bump this when you publish a material change to the terms; users will be
// re-prompted to accept the new version on next launch.
export const CURRENT_TOS_VERSION = "2026-06-07";

export async function hasAcceptedTos(): Promise<boolean> {
  const v = await SecureStore.getItemAsync(KEY);
  return v === CURRENT_TOS_VERSION;
}

export async function recordTosAcceptance(): Promise<void> {
  await SecureStore.setItemAsync(KEY, CURRENT_TOS_VERSION);
}
```

Versioning algorithm: exact-string equality against the constant. Any mismatch (older version, garbage, nil) → gate shows again. Accepting overwrites with the current constant.

---

## 6. Persistence

| Aspect | Value |
|---|---|
| Backend | expo-secure-store → **iOS Keychain** (generic password item). NOT UserDefaults. |
| Key | `tos_accepted_version` |
| Stored value | plain string `"2026-06-07"` (the `CURRENT_TOS_VERSION` constant). No JSON wrapper. |
| Scope | per-device; independent of user account; survives app relaunch. (Keychain also survives app deletion on iOS by default — same as expo-secure-store behavior, so parity is automatic.) |
| Read semantics | `getItem == CURRENT_TOS_VERSION` → accepted; anything else (nil/other) → not accepted |
| Write semantics | overwrite with `CURRENT_TOS_VERSION` on accept |

Suggested XCTest vectors (derived from the code — no RN tests exist):

| stored value | `hasAcceptedTos()` |
|---|---|
| `nil` (never set) | `false` |
| `"2026-06-07"` | `true` |
| `"2026-06-06"` (old version) | `false` |
| `""` | `false` |
| storage read throws | Gate treats as accepted (fail-open → app shown) |
| after `recordTosAcceptance()` | stored == `"2026-06-07"`, `hasAcceptedTos() == true` |

---

## 7. Component tree / layout

### 7.1 Mounting (app/_layout.tsx)

```
ErrorBoundary
└─ ThemeProvider (StickerTheme)
   ├─ TosGate
   │  └─ Stack (expo-router: "(tabs)" headerless + "modal" sheet)
   └─ StatusBar style="dark"   ← dark status-bar content regardless of gate phase
```

TosGate wraps the ENTIRE navigation stack — while blocking, no navigation/tab UI exists at all. SwiftUI equivalent: root view switches on phase: `loading` view / gate view / `AppRootView()`.

### 7.2 Loading phase

```
View (flex:1, bg cream #FFF7E8, centered both axes)
└─ Text "loading…" (HankenGrotesk_700, 14pt, inkSoft #4A4541)
```

### 7.3 Blocking phase

```
View root (flex:1, bg cream #FFF7E8)                     ← fills screen, NOT safe-area-inset aware (raw View; top padding 64 covers the notch in practice)
└─ ScrollView (vertical)
   └─ content container: paddingTop 64, paddingHorizontal 22, paddingBottom 64,
      vertical stack with gap 12, children stretch to full width (default), left-aligned text
      ├─ Text title "Before you play"           BagelFatOne 40/48, ink, marginBottom +8
      ├─ Text body  (paragraph #3 above)        HankenGrotesk_700 17/24, ink
      ├─ 4 × bulletRow: HStack (gap 8)
      │    ├─ Text "•"  17pt HankenGrotesk_700, ink, fixed width 14, centered
      │    └─ Text bulletText (flex:1)  17/24, ink   ← wraps with hanging indent effect
      ├─ Text body  (paragraph #9 above)        17/24, ink
      ├─ Text smaller (fine print, §2.1)        13/18, inkSoft, marginTop +12
      │    with inline: I AGREE (SpaceGrotesk_600), 2 underlined ink links
      └─ Pressable agreeBtn                      marginTop +24, alignSelf: CENTER (hugs content)
           capsule (radius 999), bg pink #FF4FA3, border 3pt ink,
           hard shadow ink offset (2,2) blur 0 opacity 1,
           padding H 32 / V 12
           └─ Text "I AGREE"  SpaceGrotesk_600 14pt, letterSpacing 1.4, color cream #FFF7E8
```

Alignment summary: all text left-aligned, full width; only the button is centered (`alignSelf: "center"`, intrinsic width).

Effective visual gaps (base gap 12 + margins): title→para1 = 20; between paragraphs/bullets = 12; para2→fine print = 24; fine print→button = 36.

---

## 8. Surprising behaviors / edge cases (checklist for the port)

1. **Fail-open on storage read error** — explicit comment: "SecureStore unavailable — fail open and let the user in." Gate is skipped if the Keychain read throws.
2. **Fail-closed on storage write error** — accept-button handler awaits the write with no catch; a throw leaves the user stuck on the gate (see §5.1). Decide deliberately in the port.
3. **Version bump re-prompts** — equality check against `CURRENT_TOS_VERSION = "2026-06-07"`; changing the constant re-gates every device.
4. **Per-device, pre-auth** — the gate is OUTSIDE any auth flow; anonymous users must accept too. Do not tie it to a user record.
5. **No dismiss/decline path** — the only way past the gate is "I AGREE". No close button, no back gesture (it's not a modal, it replaces the root). Hardware back on Android would background the app; on iOS irrelevant.
6. **Keychain persistence across reinstall** — expo-secure-store items survive app deletion on iOS; Keychain gives the same behavior for free. Users who reinstall will NOT see the gate again (intended parity).
7. **Hardcoded style deviations from tokens** — `loadingText` uses bodyS *family* but hardcoded size 14 (token is 13); `agreeText` uses label *family* but hardcoded size 14 (token is 11) and letterSpacing 1.4 (token is 1.1). Copy the hardcoded values, not the tokens.
8. **Bullet glyph has no lineHeight** — glyph baseline aligns with first line of wrapped bullet text via row top-alignment; fixed 14pt-wide centered column produces a hanging indent (wrapped lines align under text start, x = 22+14+8 = 44pt from screen edge).
9. **ScrollView, not fixed layout** — content must scroll on small devices (fine on SE-class screens given 64pt paddings). Bounce default.
10. **Loading flash** — there is always ≥1 frame of the "loading…" screen before either the gate or the app appears (async Keychain read). Kept intentionally minimal (cream bg matches app bg). In SwiftUI you may resolve the Keychain synchronously at init and skip this phase, but a 1:1 port keeps it.
11. **Links open externally** — `Linking.openURL` = leave the app to Safari; not an in-app SFSafariViewController. `/tos` and `/privacy` paths on `https://relatably.vercel.app`.
12. **Status bar** — `StatusBar style="dark"` is a sibling of TosGate in the root layout, so dark status-bar icons on the cream gate.
13. **`EXPO_PUBLIC_API_URL` env override** — build-time env can change the link base; no env file in repo sets it, so the vercel URL is effective in shipped builds.
