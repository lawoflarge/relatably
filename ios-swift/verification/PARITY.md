# Visual Parity Report — SwiftUI rebuild vs React Native app

Task 19 of the SwiftUI rebuild (branch `feat/swiftui-rebuild`), 2026-07-03.

## Method

- **RN baseline:** the shipping Expo app in `ios/`, built locally in Release
  (`xcodebuild -workspace Relatably.xcworkspace -scheme Relatably -configuration Release`,
  with `EXPO_PUBLIC_API_URL=https://relatably.vercel.app` exported so the embedded
  Hermes bundle hits production). No fallback needed — the build succeeded.
- **SwiftUI build:** `ios-swift` Release, ad-hoc sim signing.
- Both apps share bundle id `co.relatably.app`, so they were captured sequentially on
  the same iPhone 16 Pro Max simulator (iOS 26.5): fresh install → `simctl keychain
  reset` (fresh EULA + fresh anon user) → identical walkthrough (EULA → I AGREE →
  question → type "parity" → 3 s dwell → DROP IT → wordcloud → BOARD → ARCHIVE →
  archive detail → FRIENDS → ME). Taps via AXe, screenshots via `simctl io screenshot`,
  status bar pinned via `simctl status_bar override` (9:41 / wifi / charging) for both.
- Pairs live in `ios-swift/verification/parity/` as `rn-*.png` / `swift-*.png`
  (plus red/green blend overlays in `parity/overlay/`: RN ink = red, SwiftUI ink =
  green, coincident ink = dark).
- Comparison was numeric, not just visual: per-screen vertical ink-profile
  cross-correlation and per-element ink-band measurements (glyph rows in px @3x),
  then classification: (a) real drift → fixed, (b) documented deliberate deviation →
  listed below, (c) live-content difference → ignored.

## Drift found and FIXED: RN lineHeight semantics (systematic)

The one systematic drift the per-screen reviews had missed:

- RN/TextKit treats `lineHeight` as a **hard clamp** (`minimumLineHeight ==
  maximumLineHeight`): line pitch is exactly the token value even when the font's
  natural line box is taller, and glyphs sit `descent` up from the line-box bottom.
- BagelFatOne's natural line box is **~1.45x its point size** (hero 52 → 75.3 pt,
  h1 40 → 57.9 pt, h2 36 → 52.1 pt), i.e. TALLER than every display token
  (62/48/44/28 and the wordcloud-bubble 1.2x rule).
- `TypeStyleModifier` previously used `delta = max(0, lineHeight − natural)`, so the
  clamp-down case silently rendered at natural metrics. Measured drift before the fix:
  EULA title block −10.7 pt, board −8.3 pt, ME −9.7 pt, question title −13 pt **and**
  hero line pitch 75.3 pt instead of 62 pt (3-line question title pushed the input +
  DROP IT ~40 pt lower than RN).

**Fix** (`Relatably/DesignSystem/Tokens.swift`, `TypeStyleModifier` + new
`LinePitchClamp`): signed delta; `.padding(.top, delta)` bottom-aligns the first
baseline exactly like TextKit; for delta < 0 a `TextRenderer` (iOS 18+) draws line *i*
shifted up by `i·|delta|` (SwiftUI clamps negative `.lineSpacing` to 0) and the frame
is shrunk to exactly `n·lineHeight` via measured line count. iOS 17 falls back to
correct first-line placement with natural pitch for additional lines (visual-only,
review devices and ~all users are far past iOS 17).

Post-fix measurements (same walkthrough re-captured): question-screen ink bands match
RN within **≤1 pt** on all five elements (title lines at 92.3/155.3/217.0 pt vs RN
92.7/155.7/217.3 pt; input 271.0 vs 272.0 pt; DROP IT 350.3 vs 349.3 pt); best-shift
cross-correlation ≤5 px (1.7 pt) on every screen except friends (8 px, see deviations).
Wordcloud bubbles now also clamp to RN's `round(1.2 × fontSize)` line box.

## Per-screen verdicts (after fix)

| # | Screen | Pair | Verdict |
|---|--------|------|---------|
| 1 | EULA (TosGate) | rn/swift-01 | **PASS** — shift ≤4 px; bullet-4 wrap point differs (deviation 2) |
| 2 | Today — question | rn/swift-02 | **PASS** — all ink bands ≤1 pt; 1.2 % pixel diff |
| 3 | Today — wordcloud (post-submit) | rn/swift-03 | **PASS** — header/hint/delete pixel-aligned; cluster contents+arrangement are live data (c) |
| 4 | Board (signed-out demo board) | rn/swift-04 | **PASS** — shift 1 px, profile corr 0.999 |
| 5 | Archive list | rn/swift-05 | **PASS** — shift 1 px; both apps render the "–" date-tab placeholder (RN `date_label` ghost field faithfully ported) |
| 6 | Archive detail | rn/swift-06 | **PASS** — rows ≤5 px; verdict wrap point (deviation 2) + date format (deviation 3) |
| 7 | Friends (SIWA gate) | rn/swift-07 | **PASS** — card within 8 px (~2.7 pt; entrance-spring settle of the rotated card), subtitle wrap (deviation 2) |
| 8 | Me (settings) | rn/swift-08 | **PASS** — title/cards aligned; gear glyph (deviation 1) |

The Today `.reveal` phase (yesterday's results + "continue →") is unreachable on a
fresh install in BOTH apps (requires an answer from the previous day), so it has no
pair; its known deliberate deviation is listed below (4).

## Accepted deliberate deviations (documented, NOT drift)

1. **ME tab gear is monochrome** (`App/StickerTabBar.swift`): SwiftUI forces text
   presentation with U+FE0E; RN renders bare U+2699 as the color EMOJI gear (visible
   in rn-02/04/05/06/08). The RN source styles it with a text color (monochrome
   intent); the emoji rendering is an RN/iOS artifact we deliberately do not copy.
2. **Line-break strategy**: SwiftUI/TextKit 2 uses the `.standard` strategy (avoids
   widowed last words); RN's TextKit 1 stack wraps greedily. Same fonts, sizes and
   container widths — only the chosen break point can differ (EULA bullet 4
   "…game (the) wordcloud.", friends-gate "…and (compare) answers.", archive-detail
   "pumpkin (spice) latte"). Matching RN exactly would require UIKit labels for every
   multiline text; accepted as engine-level.
3. **Archive dates honor the device locale** (`Features/Archive/ArchiveViewModel.swift`
   `formatDate`): the RN source calls `toLocaleDateString()` *intending* device-locale
   dates, but Hermes pins it to en-US ("5/10/2026" even on a German device). Swift
   implements the source intent per the extraction report's explicit direction
   (localized "Mdyyyy" template → "10.5.2026" on de-DE). RN's behavior is an engine
   artifact we deliberately do not replicate.
4. **Reveal bottom padding** (`Features/Today/RevealView.swift`): "continue →" is
   padded above the floating tab bar; RN lets the bar cover it (the 2.1(a) dead-end
   class this rebuild fixes).
5. **UIAlertController action sheets** (`Core/ClusterModeration.swift`): same native
   control RN's ActionSheetIOS uses; chosen over `confirmationDialog` (which drops the
   Cancel button on iOS 26). Not a visual difference in stills.
6. **Lazy first-focus boot + ME refresh-on-switch** (`App/RootTabs.swift`,
   `Features/Me/MeView.swift`): behavioral timing parity with expo-router's lazy
   mount; no visual effect.
7. **iOS 17 fallback** of the line-pitch clamp (see fix above): multiline BagelFatOne
   text renders ~14 % airier on iOS 17 only.

## Fixes applied

- `Relatably/DesignSystem/Tokens.swift` — RN lineHeight clamp semantics in
  `TypeStyleModifier` (signed delta, TextKit-style first-baseline placement, iOS 18+
  `LinePitchClamp` TextRenderer, measured-line-count frame compensation).

Full suite after the fix: **271 tests, 0 failures** (iPad Air 11-inch M4, iOS 26.5).
