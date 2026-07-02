# Relatably — Design Tokens, Font Loading, PaperTexture (extraction for SwiftUI 1:1 port)

Source root: `/Users/levinschwab/Data/Claude/relatably/ios`
Files covered: `src/theme/tokens.ts`, `src/theme/useStickerFonts.ts`, `app/_layout.tsx` (font-fallback hook + root layout), `src/components/sticker/PaperTexture.tsx`, plus test fixtures `src/theme/tokens.test.ts`, `src/theme/useStickerFonts.test.ts`.

---

## 1. Design tokens — `src/theme/tokens.ts` (ENTIRE FILE, verbatim)

```ts
// Source of truth for Sticker Pop design language.
// Maps 1:1 onto mockups/01-sticker-pop/DESIGN.md.

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
  // glyphs. Display tokens therefore need headroom (~1.2x size); the web
  // mockups' tighter ratios do not translate to RN/iOS.
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

export const sp = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64,
  gutter: 22,
  section: 24,
} as const;

export const radii = {
  s: 14,
  m: 22,
  l: 28,
  xl: 36,
  pill: 999,
} as const;

export type ShadowSpec = {
  color: string;
  offset: { width: number; height: number };
  radius: number;
  opacity: number;
  elevation: number;
};

export const shadow: Record<"s" | "m" | "l", ShadowSpec> = {
  s: { color: palette.ink, offset: { width: 2, height: 2 }, radius: 0, opacity: 1, elevation: 2 },
  m: { color: palette.ink, offset: { width: 4, height: 4 }, radius: 0, opacity: 1, elevation: 4 },
  l: { color: palette.ink, offset: { width: 6, height: 6 }, radius: 0, opacity: 1, elevation: 6 },
} as const;

export const motion = {
  tap: { duration: 120, easing: "ease-out" as const },
  spring: { duration: 200, damping: 0.5 },
  wobble: { duration: 4000, range: 2 },
  popIn: { duration: 600, overshoot: 1.08, stagger: 25 },
  reveal: { duration: 700, overshoot: 1.15 },
  pulse: { duration: 1800, scale: 1.2 },
} as const;
```

### Token semantics for SwiftUI

**Palette (10 colors, sRGB hex):**

| Token | Hex | Role (as used across the app) |
|---|---|---|
| `cream` | `#FFF7E8` | app/screen background, card fill, navigation background |
| `cream2` | `#FBEED1` | secondary/alternate cream surface |
| `ink` | `#1A1A1A` | primary text, borders, hard shadows, texture dots |
| `inkSoft` | `#4A4541` | secondary/muted text |
| `pink` | `#FF4FA3` | primary accent / navigation tint / notification |
| `lemon2` | `#FFD43B` | saturated yellow accent |
| `lemon` | `#FFDF6B` | lighter yellow accent |
| `mint` | `#7AE6C3` | mint accent |
| `blue` | `#7BC8F6` | blue accent |
| `red` | `#FF5A4F` | destructive/error accent |

**Typography scale (`size` = fontSize in pt, `line` = RN lineHeight in pt = total line box height):**

| Token | size | line | family key | letterSpacing (pt) |
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

- IMPORTANT semantics: RN `lineHeight` is the ABSOLUTE height of the line box (not a multiplier, not extra spacing). SwiftUI equivalent: fixed line height via `.lineSpacing(line - uiFont.lineHeight)` or (better, exact) paragraph style / `lineHeightMultiple` targeting an absolute line box of `line` pt. Display tokens deliberately keep `line ≈ 1.2 × size` because BagelFatOne has tall ascenders that get clipped when the line box ≤ fontSize (the original web mockups used tighter ratios that DO NOT translate to iOS — keep the headroom).
- `letterSpacing` is in points → SwiftUI `.kerning(1.1)` / `.kerning(1.3)`.

**Spacing scale `sp` (pt):** 1→4, 2→8, 3→12, 4→16, 5→24, 6→32, 7→48, 8→64. Named extras: `gutter = 22` (horizontal screen gutter), `section = 24` (vertical gap between sections).

**Corner radii (pt):** s=14, m=22, l=28, xl=36, pill=999 (i.e. capsule).

**Shadows — hard "sticker" offset shadows, ZERO blur, FULL opacity:**

| Token | color | offset (w,h) | blur radius | opacity | Android elevation |
|---|---|---|---|---|---|
| s | #1A1A1A | (2, 2) | 0 | 1.0 | 2 |
| m | #1A1A1A | (4, 4) | 0 | 1.0 | 4 |
| l | #1A1A1A | (6, 6) | 0 | 1.0 | 6 |

SwiftUI: `.shadow(color: Color(hex: 0x1A1A1A), radius: 0, x: 4, y: 4)` etc. `elevation` is Android-only — ignore on iOS. These are crisp offset "cut-out sticker" shadows, not soft shadows.

**Motion constants (durations in ms):**

| Token | Values | Meaning |
|---|---|---|
| tap | duration 120, easing "ease-out" | press feedback |
| spring | duration 200, damping 0.5 | springy settle (damping is a 0–1 ratio, NOT SwiftUI's damping fraction semantics per se — visually: a moderately bouncy 200 ms spring) |
| wobble | duration 4000, range 2 | idle wobble, ±2 (degrees) over a 4 s loop |
| popIn | duration 600, overshoot 1.08, stagger 25 | entrance pop, scale overshoots to 1.08, items staggered 25 ms apart |
| reveal | duration 700, overshoot 1.15 | reveal animation, scale overshoot 1.15 |
| pulse | duration 1800, scale 1.2 | looping pulse up to 1.2× over 1.8 s |

---

## 2. Font loading

### 2a. `src/theme/useStickerFonts.ts` (ENTIRE FILE, verbatim)

```ts
import { useFonts } from "expo-font";
import { BagelFatOne_400Regular } from "@expo-google-fonts/bagel-fat-one";
import {
  HankenGrotesk_500Medium,
  HankenGrotesk_700Bold,
  HankenGrotesk_800ExtraBold,
} from "@expo-google-fonts/hanken-grotesk";
import {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";

export const STICKER_FONT_MAP = {
  BagelFatOne: BagelFatOne_400Regular,
  HankenGrotesk_500: HankenGrotesk_500Medium,
  HankenGrotesk_700: HankenGrotesk_700Bold,
  HankenGrotesk_800: HankenGrotesk_800ExtraBold,
  SpaceGrotesk_500: SpaceGrotesk_500Medium,
  SpaceGrotesk_600: SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700: SpaceGrotesk_700Bold,
} as const;

export function useStickerFonts(): readonly [boolean] {
  const [loaded] = useFonts(STICKER_FONT_MAP);
  return [loaded] as const;
}
```

### 2b. Complete font inventory (every @expo-google-fonts package + exact TTFs)

package.json versions:
- `@expo-google-fonts/bagel-fat-one` `^0.4.0`
- `@expo-google-fonts/hanken-grotesk` `^0.4.3`
- `@expo-google-fonts/space-grotesk` `^0.4.1`
- (`expo-font` `~14.0.11` does the registration)

7 fonts are registered. RN registers each TTF under the MAP KEY as the fontFamily name. Mapping table — RN family key → TTF file → real font name table entries (use the PostScript name in SwiftUI `Font.custom` / `UIFont(name:)`):

| RN fontFamily key | TTF file (in package) | TTF family (name id 1) | subfamily (id 2) | PostScript name (id 6) |
|---|---|---|---|---|
| `BagelFatOne` | `bagel-fat-one/400Regular/BagelFatOne_400Regular.ttf` | Bagel Fat One | Regular | `BagelFatOne-Regular` |
| `HankenGrotesk_500` | `hanken-grotesk/500Medium/HankenGrotesk_500Medium.ttf` | Hanken Grotesk Medium | Regular | `HankenGrotesk-Medium` |
| `HankenGrotesk_700` | `hanken-grotesk/700Bold/HankenGrotesk_700Bold.ttf` | Hanken Grotesk | Bold | `HankenGrotesk-Bold` |
| `HankenGrotesk_800` | `hanken-grotesk/800ExtraBold/HankenGrotesk_800ExtraBold.ttf` | Hanken Grotesk ExtraBold | Regular | `HankenGrotesk-ExtraBold` |
| `SpaceGrotesk_500` | `space-grotesk/500Medium/SpaceGrotesk_500Medium.ttf` | Space Grotesk Medium | Regular | `SpaceGrotesk-Medium` |
| `SpaceGrotesk_600` | `space-grotesk/600SemiBold/SpaceGrotesk_600SemiBold.ttf` | Space Grotesk SemiBold | Regular | `SpaceGrotesk-SemiBold` |
| `SpaceGrotesk_700` | `space-grotesk/700Bold/SpaceGrotesk_700Bold.ttf` | Space Grotesk | Bold | `SpaceGrotesk-Bold` |

These are Google Fonts (OFL) static instances — bundle the 7 TTFs in the SwiftUI app (UIAppFonts in Info.plist).

Actual `fontFamily:` string-literal usage counts across `src/`, `app/`, `components/` (excluding node_modules):
- `"BagelFatOne"` ×7, `"HankenGrotesk_700"` ×11, `"HankenGrotesk_800"` ×1, `"Courier"` ×2 (system monospace, in `src/components/ErrorBoundary.tsx` lines 29 & 37, sizes 11 and 10, color `#4A4541`).
- `HankenGrotesk_500` and `SpaceGrotesk_500` are LOADED but have no direct `fontFamily:` literal usage and are not referenced by any typography token — they are pre-registered spares. Bundle them anyway for 1:1 parity, but nothing renders with them today.
- `SpaceGrotesk_600` / `SpaceGrotesk_700` are used only indirectly via `typography.label` / `typography.micro` token spreads.

### 2c. Font-load watchdog + root layout — `app/_layout.tsx` (ENTIRE FILE, verbatim)

```tsx
// ios/app/_layout.tsx
import * as React from "react";
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import "react-native-reanimated";

import { useStickerFonts } from "@/src/theme/useStickerFonts";
import { palette } from "@/src/theme/tokens";
import { ErrorBoundary } from "@/src/components/ErrorBoundary";
import { TosGate } from "@/src/components/TosGate";

export const unstable_settings = {
  anchor: "(tabs)",
};

const StickerTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: palette.cream,
    card: palette.cream,
    primary: palette.pink,
    text: palette.ink,
    border: palette.ink,
    notification: palette.pink,
  },
};

// 8-second font-load watchdog: if @expo-google-fonts assets fail to load
// (e.g. corrupted asset, native bridge timing), proceed without them so the
// user sees the app instead of a permanently blank screen.
function useFontsWithFallback() {
  const [loaded] = useStickerFonts();
  const [bypass, setBypass] = React.useState(false);
  React.useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => setBypass(true), 8000);
    return () => clearTimeout(t);
  }, [loaded]);
  return loaded || bypass;
}

export default function RootLayout() {
  const ready = useFontsWithFallback();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: palette.cream, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: palette.ink, fontSize: 14 }}>loading…</Text>
      </View>
    );
  }
  return (
    <ErrorBoundary>
      <ThemeProvider value={StickerTheme}>
        <TosGate>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
          </Stack>
        </TosGate>
        <StatusBar style="dark" />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
```

**State logic (watchdog):**
- State: `loaded: Bool` (from font loader), `bypass: Bool` (initially false).
- Effect: whenever `loaded` is false, start an 8000 ms timer; on fire set `bypass = true`. Timer is cancelled (cleanup) if `loaded` flips true or the effect re-runs. `ready = loaded || bypass`.
- While `!ready`: full-screen `View`, `backgroundColor` = cream `#FFF7E8`, centered both axes, containing a `Text`: color ink `#1A1A1A`, `fontSize: 14`, SYSTEM font (deliberately not a custom font — those may be what failed). String verbatim: `loading…` (lowercase l, ends with U+2026 HORIZONTAL ELLIPSIS — a single ellipsis character, not three dots).
- SwiftUI note: since fonts will be statically bundled in the app binary, async loading cannot fail; the watchdog is an RN-only concern. For a literal 1:1 you may keep a splash state, but there is no user-visible reason to.

**Root component tree (after ready):**
```
ErrorBoundary
└─ ThemeProvider (StickerTheme)
   └─ TosGate                      ← blocks app behind Terms acceptance (separate extraction)
      └─ Stack (expo-router)
         ├─ Screen "(tabs)"  — headerShown: false (tab bar navigation, no nav header)
         └─ Screen "modal"   — presentation: "modal", title: "Modal"
   StatusBar style="dark"          ← dark status-bar content (dark icons on light cream bg)
```

**Navigation theme (StickerTheme) — colors overriding react-navigation DefaultTheme:**
- background `#FFF7E8` (cream), card `#FFF7E8` (cream), primary `#FF4FA3` (pink), text `#1A1A1A` (ink), border `#1A1A1A` (ink), notification `#FF4FA3` (pink). All other DefaultTheme values (fonts etc.) inherited.

**User-facing strings in this file:**
| String (verbatim) | Where |
|---|---|
| `loading…` | centered text on pre-font splash (system font, 14 pt, ink on cream) |
| `Modal` | navigation title of the `modal` route (modal presentation) |

---

## 3. `src/components/sticker/PaperTexture.tsx` (ENTIRE FILE, verbatim)

```tsx
import React from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import Svg, { Circle, Defs, Pattern, Rect } from "react-native-svg";

import { palette } from "@/src/theme/tokens";

export function PaperTexture() {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width={width} height={height} opacity={0.06}>
        <Defs>
          <Pattern id="dots" x={0} y={0} width={12} height={12} patternUnits="userSpaceOnUse">
            <Circle cx={1} cy={1} r={1} fill={palette.ink} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#dots)" />
      </Svg>
    </View>
  );
}
```

**Exact rendering spec:**
- Full-window overlay (absoluteFill = pinned to all 4 edges of the window, i.e. entire screen size from `useWindowDimensions`, NOT the safe area).
- Non-interactive: `pointerEvents="none"` → `allowsHitTesting(false)`.
- Content: an SVG dot grid at **6% opacity** (opacity applied to the whole SVG layer). Repeating 12 × 12 pt tile; each tile contains one filled circle, center at (1, 1) pt within the tile, radius 1 pt, fill ink `#1A1A1A`. So: dot centers at x = 1 + 12k, y = 1 + 12m for k,m ≥ 0, dot diameter 2 pt, effective color ≈ ink at 6% alpha over whatever is beneath.
- SwiftUI: a `Canvas`/tiled `Image` drawing 1 pt-radius circles on a 12 pt grid, `.opacity(0.06)`, `.allowsHitTesting(false)`, `.ignoresSafeArea()`.

**Usage / z-order convention:** `PaperTexture` is placed as a sibling INSIDE the screen's root (cream) container — typically the last/near-first child overlaying the background — on these screens (each renders it exactly where listed):
- `app/(tabs)/index.tsx` line 219 (Home)
- `app/(tabs)/settings.tsx` line 157 (Settings)
- `src/screens/FriendsScreen.tsx` lines 49, 69, 77 (three render branches — empty/loading/main each include it)
- `src/screens/ArchiveScreen.tsx` lines 35, 48 (two branches)
- `src/screens/ArchiveDetailScreen.tsx` line 95
- `src/screens/WordcloudScreen.tsx` line 83
- `src/screens/LeaderboardScreen.tsx` line 91
- `src/screens/QuestionScreen.tsx` line 29

(Those screens' own layouts are covered by other extraction reports; the invariant here: every main screen paints cream background → dot texture overlay → content, texture never intercepts touches.)

---

## 4. Persistence

None in these files. No AsyncStorage/UserDefaults keys are read or written by tokens, font hooks, or PaperTexture. (`TosGate` — referenced by `_layout.tsx` — owns TOS-acceptance persistence; see its dedicated extraction.)

---

## 5. Test fixtures → XCTest vectors

### From `src/theme/tokens.test.ts` (asserted values, usable directly as XCTest fixtures)

- palette: cream `#FFF7E8`, cream2 `#FBEED1`, ink `#1A1A1A`, inkSoft `#4A4541`, pink `#FF4FA3`, lemon2 `#FFD43B`, lemon `#FFDF6B`, mint `#7AE6C3`, blue `#7BC8F6`, red `#FF5A4F` (test title claims "10 palette colors" — exactly 10 exist).
- typography: hero.size == 52; h3.size == 22; body.size == 15; label.size == 11; micro.size == 9.
- **⚠ STALE ASSERTION:** test expects `typography.hero.line == 50`, but `tokens.ts` (source of truth, updated for iOS glyph clipping) has `hero.line = 62`. This Jest test is failing/outdated as of extraction. For the port use **62** and write the XCTest fixture as 62.
- spacing: sp[1] == 4, sp[4] == 16, sp[8] == 64, sp.gutter == 22.
- radii: s 14, m 22, l 28, xl 36, pill 999.
- shadows deep-equal (exactly the three ShadowSpec structs in §1, color literal `"#1A1A1A"`).
- motion: tap.duration 120, spring.duration 200, wobble.duration 4000.

### From `src/theme/useStickerFonts.test.ts`

- Font registry contains EXACTLY these 7 keys (sorted): `BagelFatOne`, `HankenGrotesk_500`, `HankenGrotesk_700`, `HankenGrotesk_800`, `SpaceGrotesk_500`, `SpaceGrotesk_600`, `SpaceGrotesk_700`.
- Hook returns the loader's `[loaded]` tuple pass-through (when loader says `[false]`, hook returns `[false]`). XCTest analog: font-availability check returns exactly the registered set; e.g. assert `UIFont(name: "BagelFatOne-Regular", size: 52) != nil` for all 7 PostScript names after bundling.

---

## 6. Surprising behaviors / edge cases (port checklist)

1. **8000 ms font watchdog** (`useFontsWithFallback`): app never blocks on fonts longer than 8 s; falls through to system fonts. Splash text uses the SYSTEM font on purpose.
2. **`loading…` uses U+2026**, not "...". Casing is lowercase.
3. **Line-height clipping**: BagelFatOne clips its ascenders if the line box ≤ fontSize on iOS; all display tokens carry ~1.2× headroom. Do not "tighten" line heights to match any web mockup.
4. **Shadows are hard-edged**: radius 0, opacity 1, ink-colored, offset = (2,2)/(4,4)/(6,6). Any blur is wrong. `elevation` fields are Android-only.
5. **`radii.pill = 999`** = capsule; use `Capsule()` rather than a 999 pt cornerRadius where it matters for hit shapes.
6. **PaperTexture is 6% opacity and hit-transparent**, sized to the WINDOW (ignores safe area).
7. **Two fonts are dead weight** (`HankenGrotesk_500`, `SpaceGrotesk_500`): registered/loaded, never rendered. Include for parity or consciously drop.
8. **`Courier`** (built-in iOS font) is used only inside `ErrorBoundary` debug text (11 pt / 10 pt, color `#4A4541`) — no custom mono font is bundled.
9. **Status bar is always dark-content** (dark icons) app-wide; app is light-mode-only (cream background hardcoded, no dark-mode variants anywhere in tokens).
10. **StickerTheme** must be mirrored wherever navigation chrome appears: nav/tab backgrounds cream, tint pink, text/border ink.
11. `motion.spring.damping = 0.5` is a bounce ratio from the design spec, not a physical damping coefficient; match the FEEL (200 ms, visible overshoot) rather than plugging 0.5 into `Spring(response:dampingFraction:)` blindly — verify against the RN app side-by-side.
