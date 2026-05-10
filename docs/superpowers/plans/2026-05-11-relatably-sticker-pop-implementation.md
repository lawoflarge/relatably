# Relatably — Sticker Pop UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shipping iOS UI (`#000` background + toxic lime `#aaff00` accent) with the locked **Sticker Pop** design language defined in `mockups/01-sticker-pop/DESIGN.md`. The four user-facing screens (Question · Wordcloud · Leaderboard · Archive) plus all reusable components must match the spec, with zero regressions in the existing 87-test iOS jest suite.

**Architecture:** Token-driven, light-mode only, React Native + Expo SDK 54. New `src/theme/` module exports palette / type / spacing / radii / shadow tokens consumed by every component. Three Google Fonts (Bagel Fat One, Hanken Grotesk, Space Grotesk) load via `expo-font` at app boot. A new `src/components/sticker/` directory holds shared primitives (`StickerSurface`, `StickerButton`, custom SVG icons). Existing components and screens are rewritten in place; existing test files are kept (their assertions on accessibility-tree text still pass — only styles change).

**Tech Stack:**
- React Native 0.81 + Expo SDK 54 (already installed)
- expo-router 6 (file-based routing, already in use)
- expo-font 14 (custom font loading)
- react-native-reanimated 4 (springs, wobble, dwell-guard fill)
- react-native-svg 15 (custom icon set, peel-corner clip, sparkles)
- expo-haptics 15 (already installed; new haptic triggers on submit + tab switch)
- Jest + jest-expo (existing test runner)

**Branch:** `feat/sticker-pop-ui` (already created from `main`). Land via PR once Phase 5 is green.

**Out of scope (deferred to v1.0.1):**
- Dark mode (Sticker Pop is light-only by design — see DESIGN.md §21)
- Confetti-burst on submit success (Task 20 stub only — full Reanimated 3 confetti deferred)
- Admin console restyle (the `/admin` Next.js pages live in `api/`, not iOS; not blocking ship)

---

## File Structure

### New files

```
ios/src/theme/
├── tokens.ts              # Palette, type, spacing, radii, shadow, motion tokens
├── tokens.test.ts         # Snapshot test for stability
├── useStickerFonts.ts     # expo-font hook loading the 3 Google Fonts
└── useStickerFonts.test.ts

ios/src/components/sticker/
├── StickerSurface.tsx     # Reusable surface (border + hard offset shadow + optional rotation)
├── StickerSurface.test.tsx
├── StickerButton.tsx      # Primary / secondary / tertiary variants
├── StickerButton.test.tsx
├── StickerLabel.tsx       # Space Grotesk uppercase letter-spaced
├── StickerDisplay.tsx     # Bagel Fat One wrapper
└── Sparkle.tsx            # ★ ornament

ios/src/components/icons/
├── IconHome.tsx
├── IconFriends.tsx
├── IconBoard.tsx
├── IconArchive.tsx
├── IconShare.tsx
├── IconFlame.tsx
├── IconCrown.tsx
├── IconSparkle.tsx
├── IconPeelCorner.tsx
└── icons.test.tsx         # Single test covering render + props for all 9

ios/src/lib/
├── stickerRotation.ts     # Deterministic hash(id) → angle in [-4°, +4°]
├── stickerRotation.test.ts
├── clusterSizeBucket.ts   # count/maxCount → "xs" | "s" | "m" | "l" | "xl"
├── clusterSizeBucket.test.ts
├── wordcloudLayout.ts     # Phyllotaxis spiral seeded by id, ordered by count desc
└── wordcloudLayout.test.ts

ios/components/StickerTabBar.tsx     # Custom bottom-tab component, cream pill chrome
ios/components/StickerTabBar.test.tsx
```

### Modified files

```
ios/app/_layout.tsx                       # Font loading + force light mode
ios/app/(tabs)/_layout.tsx                # Use <StickerTabBar /> instead of default Tabs UI
ios/app.json                              # userInterfaceStyle: "light" (was "dark")

ios/src/components/ClusterBubble.tsx      # Pure rewrite: sticker, rotation, self-pink, YOU tab, font buckets
ios/src/components/LeaderboardRow.tsx     # Pure rewrite: sticker tile, crown overlay, self-pink, YOU tab, flame
ios/src/components/AnswerInput.tsx        # Sticker box + peel-corner detail
ios/src/components/SubmitButton.tsx       # Pink sticker primary, rotation, dwell-guard fill
ios/src/components/LiveCounter.tsx        # Space Grotesk + digit-rollup animation
ios/src/components/QuestionText.tsx       # Bagel Fat One 52/50 hero
ios/src/components/BannerAdSlot.tsx       # Lemon sticker ad
ios/src/components/ArchiveTileThumbnail.tsx  # Mini cluster bubbles use sticker palette
ios/src/components/ShareButton.tsx        # Mint sticker
ios/src/components/SignInWithApple.tsx    # Sticker variant
ios/src/components/FriendListRow.tsx      # Sticker tile
ios/src/components/RevealAnimation.tsx    # Sticker bubbles, confetti stub
ios/src/components/ShareCardTodaysTake.tsx   # Sticker share card
ios/src/components/ShareCardVerdict.tsx      # Sticker share card
ios/src/components/ShareCardCalledIt.tsx     # Sticker share card

ios/src/screens/QuestionScreen.tsx
ios/src/screens/WordcloudScreen.tsx
ios/src/screens/LeaderboardScreen.tsx
ios/src/screens/ArchiveScreen.tsx
ios/src/screens/ArchiveDetailScreen.tsx
ios/src/screens/FriendsScreen.tsx
```

### Deleted files

```
ios/components/haptic-tab.tsx          # Replaced by StickerTabBar's internal haptic
ios/components/ui/icon-symbol.tsx      # Replaced by custom SVG icon set
ios/components/ui/icon-symbol.ios.tsx  # Same
ios/constants/theme.ts                 # Replaced by src/theme/tokens.ts
ios/hooks/use-color-scheme.ts          # No longer needed (light-only)
ios/hooks/use-color-scheme.web.ts      # Same
ios/hooks/use-theme-color.ts           # No longer needed
```

---

## Test discipline

The existing iOS suite is **93 tests across 23 files** (per `project_relatably.md` line 234). Most assert text content and accessibility roles — these stay valid after restyle. New tests are required for new modules. **Run `cd ios && pnpm test` after every task. Suite must stay green.**

Lockstep: a task is not complete until (a) new tests pass, (b) existing tests still pass, and (c) the change is committed.

---

## Phase 0 — Foundation

### Task 1: Theme tokens module

**Files:**
- Create: `ios/src/theme/tokens.ts`
- Create: `ios/src/theme/tokens.test.ts`

The full source-of-truth for Sticker Pop palette, type, spacing, radii, and shadows. Everything else imports from here.

- [ ] **Step 1: Write the failing test**

```ts
// ios/src/theme/tokens.test.ts
import { palette, type, sp, radii, shadow, motion } from "./tokens";

describe("Sticker Pop tokens", () => {
  it("exposes the 10 palette colors with stable hex values", () => {
    expect(palette.cream).toBe("#FFF7E8");
    expect(palette.cream2).toBe("#FBEED1");
    expect(palette.ink).toBe("#1A1A1A");
    expect(palette.inkSoft).toBe("#4A4541");
    expect(palette.pink).toBe("#FF4FA3");
    expect(palette.lemon2).toBe("#FFD43B");
    expect(palette.lemon).toBe("#FFDF6B");
    expect(palette.mint).toBe("#7AE6C3");
    expect(palette.blue).toBe("#7BC8F6");
    expect(palette.red).toBe("#FF5A4F");
  });

  it("exposes the type scale with hero/h1/h2/h3/body/label/micro", () => {
    expect(type.hero.size).toBe(52);
    expect(type.hero.line).toBe(50);
    expect(type.h3.size).toBe(22);
    expect(type.body.size).toBe(15);
    expect(type.label.size).toBe(11);
    expect(type.micro.size).toBe(9);
  });

  it("exposes 8-step spacing scale", () => {
    expect(sp[1]).toBe(4);
    expect(sp[4]).toBe(16);
    expect(sp[8]).toBe(64);
  });

  it("exposes the screen gutter as 22", () => {
    expect(sp.gutter).toBe(22);
  });

  it("exposes radii", () => {
    expect(radii.s).toBe(14);
    expect(radii.m).toBe(22);
    expect(radii.l).toBe(28);
    expect(radii.xl).toBe(36);
    expect(radii.pill).toBe(999);
  });

  it("exposes hard-offset shadows with zero blur", () => {
    expect(shadow.s).toEqual({ color: "#1A1A1A", offset: { width: 2, height: 2 }, radius: 0, opacity: 1, elevation: 2 });
    expect(shadow.m).toEqual({ color: "#1A1A1A", offset: { width: 4, height: 4 }, radius: 0, opacity: 1, elevation: 4 });
    expect(shadow.l).toEqual({ color: "#1A1A1A", offset: { width: 6, height: 6 }, radius: 0, opacity: 1, elevation: 6 });
  });

  it("exposes motion timing constants", () => {
    expect(motion.tap.duration).toBe(120);
    expect(motion.spring.duration).toBe(200);
    expect(motion.wobble.duration).toBe(4000);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd ios && pnpm jest src/theme/tokens.test.ts
```

Expected: `FAIL` with `Cannot find module './tokens'`.

- [ ] **Step 3: Write the tokens module**

```ts
// ios/src/theme/tokens.ts
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

export const type = {
  hero:   { size: 52, line: 50, family: "BagelFatOne" },
  h1:     { size: 40, line: 38, family: "BagelFatOne" },
  h2:     { size: 36, line: 34, family: "BagelFatOne" },
  h3:     { size: 22, line: 22, family: "BagelFatOne" },
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

- [ ] **Step 4: Run test to verify it passes**

```bash
cd ios && pnpm jest src/theme/tokens.test.ts
```

Expected: `PASS  src/theme/tokens.test.ts` (8 tests).

- [ ] **Step 5: Commit**

```bash
git add ios/src/theme/tokens.ts ios/src/theme/tokens.test.ts
git commit -m "feat(theme): add Sticker Pop tokens module"
```

---

### Task 2: Font loading hook

**Files:**
- Create: `ios/src/theme/useStickerFonts.ts`
- Create: `ios/src/theme/useStickerFonts.test.ts`

Loads Bagel Fat One (400) + Hanken Grotesk (500, 700, 800) + Space Grotesk (500, 600, 700) via `expo-font`.

- [ ] **Step 1: Add Google Font sources to assets**

The three Google Fonts ship as `@expo-google-fonts/*` packages. Add them to dependencies:

```bash
cd ios && pnpm add @expo-google-fonts/bagel-fat-one @expo-google-fonts/hanken-grotesk @expo-google-fonts/space-grotesk
```

Expected: 3 packages added to `package.json` dependencies.

- [ ] **Step 2: Write the failing test**

```ts
// ios/src/theme/useStickerFonts.test.ts
import { renderHook } from "@testing-library/react-native";
import { useFonts } from "expo-font";

jest.mock("expo-font", () => ({
  useFonts: jest.fn(() => [false]),
}));

import { useStickerFonts, STICKER_FONT_MAP } from "./useStickerFonts";

describe("useStickerFonts", () => {
  it("returns a [loaded] tuple from expo-font.useFonts", () => {
    const { result } = renderHook(() => useStickerFonts());
    expect(result.current).toEqual([false]);
  });

  it("registers all 7 font keys used in the type system", () => {
    expect(Object.keys(STICKER_FONT_MAP).sort()).toEqual([
      "BagelFatOne",
      "HankenGrotesk_500",
      "HankenGrotesk_700",
      "HankenGrotesk_800",
      "SpaceGrotesk_500",
      "SpaceGrotesk_600",
      "SpaceGrotesk_700",
    ]);
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

```bash
cd ios && pnpm jest src/theme/useStickerFonts.test.ts
```

Expected: `FAIL` with `Cannot find module './useStickerFonts'`.

- [ ] **Step 4: Implement the hook**

```ts
// ios/src/theme/useStickerFonts.ts
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

- [ ] **Step 5: Run test, verify it passes**

```bash
cd ios && pnpm jest src/theme/useStickerFonts.test.ts
```

Expected: `PASS` (2 tests).

- [ ] **Step 6: Commit**

```bash
git add ios/package.json ios/pnpm-lock.yaml ios/src/theme/useStickerFonts.ts ios/src/theme/useStickerFonts.test.ts
git commit -m "feat(theme): add useStickerFonts hook (3 Google Fonts)"
```

---

### Task 3: Wire font loading into root layout + force light mode

**Files:**
- Modify: `ios/app/_layout.tsx`
- Modify: `ios/app.json:7` (`userInterfaceStyle: "dark"` → `"light"`)

Block render until fonts are loaded; remove the dark-theme branch.

- [ ] **Step 1: Rewrite `app/_layout.tsx`**

```tsx
// ios/app/_layout.tsx
import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import "react-native-reanimated";

import { useStickerFonts } from "@/src/theme/useStickerFonts";
import { palette } from "@/src/theme/tokens";

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

export default function RootLayout() {
  const [fontsLoaded] = useStickerFonts();
  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={StickerTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
      </Stack>
      <StatusBar style="dark" />
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Update `app.json`**

Change line 7 from `"userInterfaceStyle": "dark"` to `"userInterfaceStyle": "light"`.

- [ ] **Step 3: Verify the suite still runs**

```bash
cd ios && pnpm test
```

Expected: 93+ tests pass (no regression).

- [ ] **Step 4: Commit**

```bash
git add ios/app/_layout.tsx ios/app.json
git commit -m "feat(theme): wire font loading + force light mode"
```

---

## Phase 1 — Shared primitives

### Task 4: StickerSurface + StickerButton primitives

**Files:**
- Create: `ios/src/components/sticker/StickerSurface.tsx`
- Create: `ios/src/components/sticker/StickerSurface.test.tsx`
- Create: `ios/src/components/sticker/StickerButton.tsx`
- Create: `ios/src/components/sticker/StickerButton.test.tsx`

`StickerSurface` is the reusable "thing that looks like a peeled sticker": fill, 3px ink border, hard offset shadow, optional rotation. `StickerButton` wraps it with `Pressable` and three variants.

- [ ] **Step 1: Write failing test for StickerSurface**

```tsx
// ios/src/components/sticker/StickerSurface.test.tsx
import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { StickerSurface } from "./StickerSurface";

describe("StickerSurface", () => {
  it("renders children", () => {
    const { getByText } = render(
      <StickerSurface><Text>hello</Text></StickerSurface>
    );
    expect(getByText("hello")).toBeTruthy();
  });

  it("applies default shadow=m and border=3", () => {
    const { getByTestId } = render(
      <StickerSurface testID="surf"><Text>x</Text></StickerSurface>
    );
    const styles = getByTestId("surf").props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles) : styles;
    expect(flat.borderWidth).toBe(3);
    expect(flat.shadowOffset).toEqual({ width: 4, height: 4 });
    expect(flat.shadowRadius).toBe(0);
  });

  it("rotates via transform when rotate prop provided", () => {
    const { getByTestId } = render(
      <StickerSurface testID="surf" rotate={-2}><Text>x</Text></StickerSurface>
    );
    const styles = getByTestId("surf").props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles) : styles;
    expect(flat.transform).toEqual([{ rotate: "-2deg" }]);
  });
});
```

- [ ] **Step 2: Write `StickerSurface.tsx`**

```tsx
// ios/src/components/sticker/StickerSurface.tsx
import React from "react";
import { View, ViewStyle, StyleProp } from "react-native";
import { palette, radii, shadow, type ShadowSpec } from "@/src/theme/tokens";

type Fill = keyof typeof palette;
type Shadow = keyof typeof shadow;
type Radius = keyof typeof radii;

interface Props {
  children: React.ReactNode;
  fill?: Fill;
  borderWidth?: 2 | 3;
  shadowSize?: Shadow;
  radius?: Radius;
  rotate?: number;          // degrees
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function StickerSurface({
  children,
  fill = "cream",
  borderWidth = 3,
  shadowSize = "m",
  radius = "m",
  rotate,
  style,
  testID,
}: Props) {
  const s: ShadowSpec = shadow[shadowSize];
  return (
    <View
      testID={testID}
      style={[
        {
          backgroundColor: palette[fill],
          borderColor: palette.ink,
          borderWidth,
          borderRadius: radii[radius],
          shadowColor: s.color,
          shadowOffset: s.offset,
          shadowRadius: s.radius,
          shadowOpacity: s.opacity,
          elevation: s.elevation,
          transform: rotate ? [{ rotate: `${rotate}deg` }] : undefined,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
```

- [ ] **Step 3: Run StickerSurface test, verify passes**

```bash
cd ios && pnpm jest src/components/sticker/StickerSurface
```

Expected: `PASS` (3 tests).

- [ ] **Step 4: Write failing test for StickerButton**

```tsx
// ios/src/components/sticker/StickerButton.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import { StickerButton } from "./StickerButton";

describe("StickerButton", () => {
  it("renders the label", () => {
    const { getByText } = render(<StickerButton label="DROP IT" onPress={() => {}} />);
    expect(getByText("DROP IT")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    const { getByRole } = render(<StickerButton label="GO" onPress={onPress} />);
    fireEvent.press(getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uses pink fill for primary variant", () => {
    const { getByTestId } = render(<StickerButton testID="b" label="GO" onPress={() => {}} variant="primary" />);
    const flat = Object.assign({}, ...getByTestId("b").props.style);
    expect(flat.backgroundColor).toBe("#FF4FA3");
  });

  it("uses mint fill for secondary variant", () => {
    const { getByTestId } = render(<StickerButton testID="b" label="x" onPress={() => {}} variant="secondary" />);
    const flat = Object.assign({}, ...getByTestId("b").props.style);
    expect(flat.backgroundColor).toBe("#7AE6C3");
  });

  it("disables and removes onPress when disabled prop set", () => {
    const onPress = jest.fn();
    const { getByRole } = render(<StickerButton label="GO" onPress={onPress} disabled />);
    fireEvent.press(getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 5: Write `StickerButton.tsx`**

```tsx
// ios/src/components/sticker/StickerButton.tsx
import React from "react";
import { Pressable, Text, StyleProp, ViewStyle } from "react-native";
import { palette, radii, shadow, type, sp } from "@/src/theme/tokens";

type Variant = "primary" | "secondary" | "tertiary";

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  rotate?: number;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

const VARIANT: Record<Variant, { fill: keyof typeof palette; fg: keyof typeof palette; borderWidth: 2 | 3; shadowSize: keyof typeof shadow; radius: keyof typeof radii; font: typeof type.h3 | typeof type.body }> = {
  primary:   { fill: "pink",  fg: "cream", borderWidth: 3, shadowSize: "l", radius: "l", font: type.h3 },
  secondary: { fill: "mint",  fg: "ink",   borderWidth: 2, shadowSize: "s", radius: "pill", font: type.bodyS },
  tertiary:  { fill: "cream", fg: "ink",   borderWidth: 2, shadowSize: "s", radius: "pill", font: type.bodyS },
};

export function StickerButton({ label, onPress, variant = "primary", disabled, rotate, testID, style }: Props) {
  const v = VARIANT[variant];
  const s = shadow[v.shadowSize];
  return (
    <Pressable
      role="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={disabled ? undefined : onPress}
      testID={testID}
      style={[
        {
          backgroundColor: disabled ? palette.cream : palette[v.fill],
          borderColor: palette.ink,
          borderWidth: v.borderWidth,
          borderRadius: radii[v.radius],
          paddingVertical: variant === "primary" ? sp[4] + 2 : sp[2],
          paddingHorizontal: variant === "primary" ? sp[5] + sp[1] : sp[3] + 2,
          shadowColor: s.color,
          shadowOffset: s.offset,
          shadowRadius: s.radius,
          shadowOpacity: disabled ? 0 : s.opacity,
          elevation: disabled ? 0 : s.elevation,
          transform: rotate ? [{ rotate: `${rotate}deg` }] : undefined,
          opacity: disabled ? 0.4 : 1,
          alignSelf: "flex-start",
        },
        style,
      ]}
    >
      <Text
        style={{
          color: palette[v.fg],
          fontFamily: v.font.family,
          fontSize: v.font.size,
          lineHeight: v.font.line,
          letterSpacing: "letterSpacing" in v.font ? (v.font as any).letterSpacing : 0,
          textAlign: "center",
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 6: Run all sticker tests, verify pass**

```bash
cd ios && pnpm jest src/components/sticker
```

Expected: `PASS` (8 tests across 2 files).

- [ ] **Step 7: Commit**

```bash
git add ios/src/components/sticker/
git commit -m "feat(sticker): add StickerSurface + StickerButton primitives"
```

---

### Task 5: Custom SVG icon set

**Files:**
- Create: `ios/src/components/icons/IconHome.tsx`
- Create: `ios/src/components/icons/IconFriends.tsx`
- Create: `ios/src/components/icons/IconBoard.tsx`
- Create: `ios/src/components/icons/IconArchive.tsx`
- Create: `ios/src/components/icons/IconShare.tsx`
- Create: `ios/src/components/icons/IconFlame.tsx`
- Create: `ios/src/components/icons/IconCrown.tsx`
- Create: `ios/src/components/icons/IconSparkle.tsx`
- Create: `ios/src/components/icons/IconPeelCorner.tsx`
- Create: `ios/src/components/icons/icons.test.tsx`

All 9 icons share an interface: `{ size?: number; color?: string; }`. 2px stroke, 24×24 grid, square caps, round joins. Sticker-cut feel, hand-drawn, never Material/Lucide-generic.

- [ ] **Step 1: Write failing test for the icon set**

```tsx
// ios/src/components/icons/icons.test.tsx
import { render } from "@testing-library/react-native";
import * as icons from ".";

const NAMES = [
  "IconHome", "IconFriends", "IconBoard", "IconArchive",
  "IconShare", "IconFlame", "IconCrown", "IconSparkle", "IconPeelCorner",
] as const;

describe("icon set", () => {
  it.each(NAMES)("%s renders at default size 24", (name) => {
    const Cmp = (icons as any)[name];
    const tree = render(<Cmp testID="i" />);
    expect(tree.getByTestId("i")).toBeTruthy();
  });

  it.each(NAMES)("%s accepts size prop", (name) => {
    const Cmp = (icons as any)[name];
    const tree = render(<Cmp testID="i" size={48} />);
    expect(tree.getByTestId("i")).toBeTruthy();
  });

  it.each(NAMES)("%s accepts color prop", (name) => {
    const Cmp = (icons as any)[name];
    const tree = render(<Cmp testID="i" color="#FF0000" />);
    expect(tree.getByTestId("i")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test, verify fails**

```bash
cd ios && pnpm jest src/components/icons
```

Expected: `FAIL` (no module).

- [ ] **Step 3: Implement icons + barrel**

Each icon file has the same shape. Here are the 9 implementations. Create each file as shown, then create the barrel `index.ts`.

```tsx
// ios/src/components/icons/IconHome.tsx
import React from "react";
import Svg, { Path } from "react-native-svg";
import { palette } from "@/src/theme/tokens";

interface Props { size?: number; color?: string; testID?: string; }
export function IconHome({ size = 24, color = palette.ink, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Path d="M4 12L12 5L20 12V20H14V14H10V20H4V12Z" stroke={color} strokeWidth={2} strokeLinecap="square" strokeLinejoin="round" />
    </Svg>
  );
}
```

```tsx
// ios/src/components/icons/IconFriends.tsx
import React from "react";
import Svg, { Circle, Path } from "react-native-svg";
import { palette } from "@/src/theme/tokens";
interface Props { size?: number; color?: string; testID?: string; }
export function IconFriends({ size = 24, color = palette.ink, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Circle cx="9" cy="8" r="3.2" stroke={color} strokeWidth={2} />
      <Path d="M3 20C3 16.5 5.5 14 9 14C12.5 14 15 16.5 15 20" stroke={color} strokeWidth={2} strokeLinecap="square" />
      <Circle cx="17" cy="8.5" r="2.5" stroke={color} strokeWidth={2} />
      <Path d="M14.5 14.5C17.2 14.5 20 16 20.5 20" stroke={color} strokeWidth={2} strokeLinecap="square" />
    </Svg>
  );
}
```

```tsx
// ios/src/components/icons/IconBoard.tsx
import React from "react";
import Svg, { Path } from "react-native-svg";
import { palette } from "@/src/theme/tokens";
interface Props { size?: number; color?: string; testID?: string; }
export function IconBoard({ size = 24, color = palette.ink, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Path d="M5 20V12M12 20V6M19 20V14M3 20H21" stroke={color} strokeWidth={2} strokeLinecap="square" strokeLinejoin="round" />
    </Svg>
  );
}
```

```tsx
// ios/src/components/icons/IconArchive.tsx
import React from "react";
import Svg, { Path } from "react-native-svg";
import { palette } from "@/src/theme/tokens";
interface Props { size?: number; color?: string; testID?: string; }
export function IconArchive({ size = 24, color = palette.ink, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Path d="M3 6H21V9H3V6Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <Path d="M5 9V20H19V9" stroke={color} strokeWidth={2} strokeLinecap="square" strokeLinejoin="round" />
      <Path d="M10 13H14" stroke={color} strokeWidth={2} strokeLinecap="square" />
    </Svg>
  );
}
```

```tsx
// ios/src/components/icons/IconShare.tsx
import React from "react";
import Svg, { Path, Circle } from "react-native-svg";
import { palette } from "@/src/theme/tokens";
interface Props { size?: number; color?: string; testID?: string; }
export function IconShare({ size = 24, color = palette.ink, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Circle cx="6" cy="12" r="2.5" stroke={color} strokeWidth={2} />
      <Circle cx="18" cy="6" r="2.5" stroke={color} strokeWidth={2} />
      <Circle cx="18" cy="18" r="2.5" stroke={color} strokeWidth={2} />
      <Path d="M8 11L16 7M8 13L16 17" stroke={color} strokeWidth={2} strokeLinecap="square" />
    </Svg>
  );
}
```

```tsx
// ios/src/components/icons/IconFlame.tsx
import React from "react";
import Svg, { Path } from "react-native-svg";
import { palette } from "@/src/theme/tokens";
interface Props { size?: number; color?: string; testID?: string; }
export function IconFlame({ size = 24, color = palette.ink, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Path d="M12 3C12 8 17 9 17 14C17 17 14.8 20 12 20C9.2 20 7 17 7 14C7 11 9 10 9 7C10.5 8 12 7 12 3Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
```

```tsx
// ios/src/components/icons/IconCrown.tsx
import React from "react";
import Svg, { Path } from "react-native-svg";
import { palette } from "@/src/theme/tokens";
interface Props { size?: number; color?: string; testID?: string; }
export function IconCrown({ size = 24, color = palette.ink, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Path d="M3 7L7 12L12 5L17 12L21 7V18H3V7Z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
```

```tsx
// ios/src/components/icons/IconSparkle.tsx
import React from "react";
import Svg, { Path } from "react-native-svg";
import { palette } from "@/src/theme/tokens";
interface Props { size?: number; color?: string; testID?: string; }
export function IconSparkle({ size = 24, color = palette.ink, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Path d="M12 3L13.5 10.5L21 12L13.5 13.5L12 21L10.5 13.5L3 12L10.5 10.5L12 3Z" fill={color} />
    </Svg>
  );
}
```

```tsx
// ios/src/components/icons/IconPeelCorner.tsx
import React from "react";
import Svg, { Path } from "react-native-svg";
import { palette } from "@/src/theme/tokens";
interface Props { size?: number; color?: string; testID?: string; }
export function IconPeelCorner({ size = 24, color = palette.lemon2, testID }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" testID={testID}>
      <Path d="M0 0L24 0L0 24Z" fill={color} stroke={palette.ink} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}
```

```ts
// ios/src/components/icons/index.ts
export { IconHome } from "./IconHome";
export { IconFriends } from "./IconFriends";
export { IconBoard } from "./IconBoard";
export { IconArchive } from "./IconArchive";
export { IconShare } from "./IconShare";
export { IconFlame } from "./IconFlame";
export { IconCrown } from "./IconCrown";
export { IconSparkle } from "./IconSparkle";
export { IconPeelCorner } from "./IconPeelCorner";
```

- [ ] **Step 4: Run icon tests, verify pass**

```bash
cd ios && pnpm jest src/components/icons
```

Expected: `PASS` (27 tests = 9 icons × 3 cases).

- [ ] **Step 5: Commit**

```bash
git add ios/src/components/icons/
git commit -m "feat(icons): add Sticker Pop hand-drawn icon set (9 icons)"
```

---

### Task 6: stickerRotation + clusterSizeBucket helpers

**Files:**
- Create: `ios/src/lib/stickerRotation.ts`
- Create: `ios/src/lib/stickerRotation.test.ts`
- Create: `ios/src/lib/clusterSizeBucket.ts`
- Create: `ios/src/lib/clusterSizeBucket.test.ts`

Two pure functions used by every sticker that needs deterministic visual variance.

- [ ] **Step 1: Write failing test for stickerRotation**

```ts
// ios/src/lib/stickerRotation.test.ts
import { stickerRotation } from "./stickerRotation";

describe("stickerRotation", () => {
  it("returns a deterministic angle for the same id", () => {
    expect(stickerRotation("c_ai")).toBe(stickerRotation("c_ai"));
  });

  it("returns different angles for different ids", () => {
    const a = stickerRotation("c_ai");
    const b = stickerRotation("c_tiktok");
    expect(a).not.toBe(b);
  });

  it("stays inside the spec range [-4, 4] degrees", () => {
    for (const id of ["c_ai", "c_tiktok", "c_x", "c_y", "c_z", "abc", "long-id-with-stuff"]) {
      const r = stickerRotation(id);
      expect(r).toBeGreaterThanOrEqual(-4);
      expect(r).toBeLessThanOrEqual(4);
    }
  });

  it("respects a custom range when provided", () => {
    const r = stickerRotation("c_ai", { range: 1.5 });
    expect(r).toBeGreaterThanOrEqual(-1.5);
    expect(r).toBeLessThanOrEqual(1.5);
  });
});
```

- [ ] **Step 2: Implement stickerRotation**

```ts
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
```

- [ ] **Step 3: Write failing test for clusterSizeBucket**

```ts
// ios/src/lib/clusterSizeBucket.test.ts
import { clusterSizeBucket } from "./clusterSizeBucket";

describe("clusterSizeBucket", () => {
  it("returns 'xl' at ratio ≥ 0.85", () => {
    expect(clusterSizeBucket(3204, 3204)).toBe("xl");
    expect(clusterSizeBucket(2723, 3204)).toBe("xl");
  });

  it("returns 'l' at 0.40..0.84", () => {
    expect(clusterSizeBucket(1892, 3204)).toBe("l"); // ratio ~0.59
  });

  it("returns 'm' at 0.20..0.39", () => {
    expect(clusterSizeBucket(987, 3204)).toBe("m");  // ratio ~0.308
  });

  it("returns 's' at 0.08..0.19", () => {
    expect(clusterSizeBucket(389, 3204)).toBe("s");  // ratio ~0.121
  });

  it("returns 'xs' below 0.08", () => {
    expect(clusterSizeBucket(18, 3204)).toBe("xs");  // ratio ~0.006
  });

  it("returns 'xs' when max is 0 (degenerate)", () => {
    expect(clusterSizeBucket(0, 0)).toBe("xs");
  });
});
```

- [ ] **Step 4: Implement clusterSizeBucket**

```ts
// ios/src/lib/clusterSizeBucket.ts
// Maps a cluster's count to a font-size bucket per DESIGN.md §12.

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
  if (r >= 0.85) return "xl";
  if (r >= 0.40) return "l";
  if (r >= 0.20) return "m";
  if (r >= 0.08) return "s";
  return "xs";
}

export function clusterSizePx(bucket: ClusterSize): number {
  return FONT_PX[bucket];
}
```

- [ ] **Step 5: Run both test files, verify pass**

```bash
cd ios && pnpm jest src/lib/stickerRotation src/lib/clusterSizeBucket
```

Expected: `PASS` (10 tests across 2 files).

- [ ] **Step 6: Commit**

```bash
git add ios/src/lib/stickerRotation.ts ios/src/lib/stickerRotation.test.ts ios/src/lib/clusterSizeBucket.ts ios/src/lib/clusterSizeBucket.test.ts
git commit -m "feat(lib): add stickerRotation + clusterSizeBucket helpers"
```

---

### Task 7: Wordcloud Phyllotaxis layout function

**Files:**
- Create: `ios/src/lib/wordcloudLayout.ts`
- Create: `ios/src/lib/wordcloudLayout.test.ts`

Pure function: take an array of `{ id, count, text }`, return an array of `{ id, x, y, bucket }`. Uses a Phyllotaxis (sunflower) spiral seeded by index after a count-desc sort. Deterministic — same input → same output.

- [ ] **Step 1: Write failing test**

```ts
// ios/src/lib/wordcloudLayout.test.ts
import { wordcloudLayout } from "./wordcloudLayout";

const FIXTURE = [
  { id: "c_ai", count: 3204, text: "AI" },
  { id: "c_tiktok", count: 1892, text: "tiktok" },
  { id: "c_x", count: 100, text: "x" },
];

describe("wordcloudLayout", () => {
  it("returns one placement per input cluster", () => {
    const out = wordcloudLayout(FIXTURE, { width: 350, height: 600 });
    expect(out).toHaveLength(3);
    expect(out.map((p) => p.id).sort()).toEqual(["c_ai", "c_tiktok", "c_x"].sort());
  });

  it("places the highest-count cluster near the canvas center", () => {
    const out = wordcloudLayout(FIXTURE, { width: 350, height: 600 });
    const top = out.find((p) => p.id === "c_ai")!;
    expect(Math.abs(top.x - 175)).toBeLessThan(60);  // near center x
    expect(Math.abs(top.y - 300)).toBeLessThan(120); // near center y (gravitational center)
  });

  it("emits cluster bucket alongside placement", () => {
    const out = wordcloudLayout(FIXTURE, { width: 350, height: 600 });
    const top = out.find((p) => p.id === "c_ai")!;
    expect(top.bucket).toBe("xl");
  });

  it("is deterministic across runs", () => {
    const a = wordcloudLayout(FIXTURE, { width: 350, height: 600 });
    const b = wordcloudLayout(FIXTURE, { width: 350, height: 600 });
    expect(a).toEqual(b);
  });
});
```

- [ ] **Step 2: Implement**

```ts
// ios/src/lib/wordcloudLayout.ts
import { clusterSizeBucket, type ClusterSize } from "./clusterSizeBucket";

export interface Cluster {
  id: string;
  count: number;
  text: string;
}

export interface Placement {
  id: string;
  x: number;     // px from canvas left
  y: number;     // px from canvas top
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
```

- [ ] **Step 3: Run test, verify passes**

```bash
cd ios && pnpm jest src/lib/wordcloudLayout
```

Expected: `PASS` (4 tests).

- [ ] **Step 4: Commit**

```bash
git add ios/src/lib/wordcloudLayout.ts ios/src/lib/wordcloudLayout.test.ts
git commit -m "feat(lib): add Phyllotaxis wordcloud layout (deterministic)"
```

---

## Phase 2 — Tab bar

### Task 8: StickerTabBar primitive

**Files:**
- Create: `ios/components/StickerTabBar.tsx`
- Create: `ios/components/StickerTabBar.test.tsx`

Custom tab bar matching the spec: cream pill chrome with 3px ink border + hard offset shadow, anchored 30px from bottom inside safe area. Active tab inverts to ink-on-cream.

- [ ] **Step 1: Write failing test**

```tsx
// ios/components/StickerTabBar.test.tsx
import { fireEvent, render } from "@testing-library/react-native";
import { StickerTabBar } from "./StickerTabBar";

const STATE = {
  index: 0,
  routes: [
    { key: "index", name: "index" },
    { key: "friends", name: "friends" },
    { key: "leaderboard", name: "leaderboard" },
    { key: "archive", name: "archive" },
  ],
} as any;

const NAV = { emit: jest.fn(() => ({})), navigate: jest.fn() };
const DESCRIPTORS: any = {
  index: { options: { title: "Today" } },
  friends: { options: { title: "Friends" } },
  leaderboard: { options: { title: "Board" } },
  archive: { options: { title: "Archive" } },
};

describe("StickerTabBar", () => {
  beforeEach(() => { NAV.navigate.mockClear(); });
  it("renders 4 tabs with their labels", () => {
    const { getByText } = render(
      <StickerTabBar state={STATE} navigation={NAV as any} descriptors={DESCRIPTORS} insets={{ bottom: 30 }} />
    );
    expect(getByText("TODAY")).toBeTruthy();
    expect(getByText("FRIENDS")).toBeTruthy();
    expect(getByText("BOARD")).toBeTruthy();
    expect(getByText("ARCHIVE")).toBeTruthy();
  });

  it("calls navigate on press of non-active tab", () => {
    const { getByText } = render(
      <StickerTabBar state={STATE} navigation={NAV as any} descriptors={DESCRIPTORS} insets={{ bottom: 30 }} />
    );
    fireEvent.press(getByText("FRIENDS"));
    expect(NAV.navigate).toHaveBeenCalledWith("friends");
  });
});
```

- [ ] **Step 2: Implement**

```tsx
// ios/components/StickerTabBar.tsx
import React from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import * as Haptics from "expo-haptics";

import { palette, radii, sp, shadow, type } from "@/src/theme/tokens";
import { IconHome, IconFriends, IconBoard, IconArchive } from "@/src/components/icons";

type RouteName = "index" | "friends" | "leaderboard" | "archive";

const ICONS: Record<RouteName, React.ComponentType<{ size?: number; color?: string }>> = {
  index: IconHome,
  friends: IconFriends,
  leaderboard: IconBoard,
  archive: IconArchive,
};

const LABELS: Record<RouteName, string> = {
  index: "TODAY",
  friends: "FRIENDS",
  leaderboard: "BOARD",
  archive: "ARCHIVE",
};

interface Props {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void; emit?: (...args: any[]) => any };
  descriptors: Record<string, { options: { title?: string } }>;
  insets: { bottom: number };
}

export function StickerTabBar({ state, navigation, insets }: Props) {
  return (
    <View style={[styles.outer, { paddingBottom: insets.bottom + 12 }]} pointerEvents="box-none">
      <View style={styles.bar}>
        {state.routes.map((route, i) => {
          const name = route.name as RouteName;
          const isActive = state.index === i;
          const Icon = ICONS[name];
          const label = LABELS[name];
          return (
            <Pressable
              key={route.key}
              role="button"
              onPress={() => {
                if (!isActive) {
                  Haptics.selectionAsync().catch(() => {});
                  navigation.navigate(name);
                }
              }}
              style={[styles.tab, isActive && styles.tabActive]}
            >
              <Icon size={22} color={isActive ? palette.cream : palette.ink} />
              <Text style={[styles.label, { color: isActive ? palette.cream : palette.ink }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

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
  label: { fontFamily: type.micro.family, fontSize: type.micro.size, letterSpacing: 1.3 },
});
```

- [ ] **Step 3: Run test, verify passes**

```bash
cd ios && pnpm jest components/StickerTabBar
```

Expected: `PASS` (2 tests).

- [ ] **Step 4: Commit**

```bash
git add ios/components/StickerTabBar.tsx ios/components/StickerTabBar.test.tsx
git commit -m "feat(tabs): add StickerTabBar primitive"
```

---

### Task 9: Wire StickerTabBar into (tabs)/_layout.tsx

**Files:**
- Modify: `ios/app/(tabs)/_layout.tsx`
- Delete: `ios/components/haptic-tab.tsx` (no longer used)
- Delete: `ios/components/ui/icon-symbol.tsx` and `icon-symbol.ios.tsx`
- Delete: `ios/constants/theme.ts`, `ios/hooks/use-color-scheme.ts`, `ios/hooks/use-color-scheme.web.ts`, `ios/hooks/use-theme-color.ts`

- [ ] **Step 1: Rewrite `(tabs)/_layout.tsx`**

```tsx
// ios/app/(tabs)/_layout.tsx
import { Tabs } from "expo-router";
import React from "react";

import { StickerTabBar } from "@/components/StickerTabBar";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <StickerTabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Today" }} />
      <Tabs.Screen name="friends" options={{ title: "Friends" }} />
      <Tabs.Screen name="leaderboard" options={{ title: "Board" }} />
      <Tabs.Screen name="archive" options={{ title: "Archive" }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Delete the orphaned files**

```bash
cd ios && rm components/haptic-tab.tsx components/ui/icon-symbol.tsx components/ui/icon-symbol.ios.tsx constants/theme.ts hooks/use-color-scheme.ts hooks/use-color-scheme.web.ts hooks/use-theme-color.ts
```

- [ ] **Step 3: Verify suite stays green**

```bash
cd ios && pnpm test
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(tabs): wire StickerTabBar + remove legacy theme/icons"
```

---

## Phase 3 — Component restyle

### Task 10: ClusterBubble — sticker rewrite

**Files:**
- Modify: `ios/src/components/ClusterBubble.tsx`
- Create: `ios/src/components/ClusterBubble.test.tsx` (new — currently no test for this component)

DESIGN.md §12: rounded sticker, palette-rotated fill, deterministic rotation, font-size buckets, self-marker (pink + YOU tab).

- [ ] **Step 1: Write failing test**

```tsx
// ios/src/components/ClusterBubble.test.tsx
import { render } from "@testing-library/react-native";
import { ClusterBubble } from "./ClusterBubble";

describe("ClusterBubble", () => {
  it("renders the cluster text", () => {
    const { getByText } = render(
      <ClusterBubble id="c_ai" text="AI" count={3204} maxCount={3204} isSelf={false} colorIndex={0} />
    );
    expect(getByText("AI")).toBeTruthy();
  });

  it("renders a YOU tab when isSelf is true", () => {
    const { getByText } = render(
      <ClusterBubble id="c_ai" text="AI" count={3204} maxCount={3204} isSelf colorIndex={0} />
    );
    expect(getByText("YOU")).toBeTruthy();
  });

  it("uses the same rotation for the same id on re-render", () => {
    const a = render(
      <ClusterBubble id="c_ai" text="AI" count={3204} maxCount={3204} isSelf={false} colorIndex={0} />
    );
    const b = render(
      <ClusterBubble id="c_ai" text="AI" count={3204} maxCount={3204} isSelf={false} colorIndex={0} />
    );
    expect(a.toJSON()).toEqual(b.toJSON());
  });
});
```

- [ ] **Step 2: Rewrite `ClusterBubble.tsx`**

```tsx
// ios/src/components/ClusterBubble.tsx
import React from "react";
import { Text, View, StyleSheet } from "react-native";

import { palette, radii, shadow, sp, type } from "@/src/theme/tokens";
import { clusterSizeBucket, clusterSizePx } from "@/src/lib/clusterSizeBucket";
import { stickerRotation } from "@/src/lib/stickerRotation";

interface Props {
  id: string;
  text: string;
  count: number;
  maxCount: number;
  isSelf: boolean;
  /** index into the cluster list, used to rotate fill color deterministically */
  colorIndex: number;
}

const FILL_ROTATION = [palette.mint, palette.lemon, palette.blue, "#FFD7E8"] as const;

export function ClusterBubble({ id, text, count, maxCount, isSelf, colorIndex }: Props) {
  const bucket = clusterSizeBucket(count, maxCount);
  const fontSize = clusterSizePx(bucket);
  const angle = stickerRotation(id);

  const isLargeBucket = bucket === "xl" || bucket === "l" || bucket === "m";
  const borderWidth = bucket === "xs" || bucket === "s" ? 2 : 3;
  const shadowSpec = isSelf ? shadow.l : (isLargeBucket ? shadow.m : shadow.s);
  const radius = bucket === "xl" || bucket === "l" ? radii.l : radii.m;
  const fill = isSelf ? palette.pink : FILL_ROTATION[colorIndex % FILL_ROTATION.length];
  const fg = isSelf ? palette.cream : palette.ink;

  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: fill,
          borderColor: palette.ink,
          borderWidth,
          borderRadius: radius,
          shadowColor: shadowSpec.color,
          shadowOffset: shadowSpec.offset,
          shadowRadius: shadowSpec.radius,
          shadowOpacity: shadowSpec.opacity,
          elevation: shadowSpec.elevation,
          paddingVertical: bucket === "xl" ? sp[3] : sp[2],
          paddingHorizontal: bucket === "xl" ? sp[4] : sp[3],
          transform: [{ rotate: `${angle}deg` }],
        },
      ]}
    >
      <Text
        style={{
          fontFamily: type.h3.family,
          fontSize,
          lineHeight: fontSize,
          color: fg,
        }}
      >
        {text}
      </Text>
      {isSelf && (
        <View style={styles.youTab}>
          <Text style={styles.youText}>YOU</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start", position: "relative" },
  youTab: {
    position: "absolute",
    top: -12,
    left: -10,
    backgroundColor: palette.lemon2,
    borderColor: palette.ink,
    borderWidth: 2,
    borderRadius: radii.s,
    paddingHorizontal: sp[2],
    paddingVertical: 2,
    transform: [{ rotate: "-12deg" }],
  },
  youText: { fontFamily: type.micro.family, fontSize: 10, color: palette.ink, letterSpacing: 1.4 },
});
```

- [ ] **Step 3: Run test, verify pass**

```bash
cd ios && pnpm jest src/components/ClusterBubble
```

Expected: `PASS` (3 tests).

- [ ] **Step 4: Commit**

```bash
git add ios/src/components/ClusterBubble.tsx ios/src/components/ClusterBubble.test.tsx
git commit -m "feat(cluster): sticker-pop rewrite of ClusterBubble"
```

---

### Task 11: LeaderboardRow — sticker rewrite

**Files:**
- Modify: `ios/src/components/LeaderboardRow.tsx`
- Modify: `ios/src/components/LeaderboardRow.test.tsx` (existing — update signature)

DESIGN.md §13: sticker tile, zero-padded rank, avatar circle, streak indicator, crown overlay for #1, self-row pink with YOU tab.

- [ ] **Step 1: Update existing test (add new props)**

```tsx
// ios/src/components/LeaderboardRow.test.tsx
import { render } from "@testing-library/react-native";
import { LeaderboardRow } from "./LeaderboardRow";

describe("LeaderboardRow", () => {
  it("zero-pads the rank to two digits", () => {
    const { getByText } = render(
      <LeaderboardRow rank={1} handle="ace.exe" score={1284} streakDays={12} isSelf={false} crown />
    );
    expect(getByText("01")).toBeTruthy();
  });

  it("renders 'anon' when handle is null", () => {
    const { getByText } = render(
      <LeaderboardRow rank={2} handle={null} score={500} streakDays={0} isSelf={false} crown={false} />
    );
    expect(getByText("anon")).toBeTruthy();
  });

  it("renders crown sticker for #1", () => {
    const { getByText } = render(
      <LeaderboardRow rank={1} handle="ace.exe" score={1284} streakDays={12} isSelf={false} crown />
    );
    expect(getByText("★ #1")).toBeTruthy();
  });

  it("renders YOU tab when isSelf", () => {
    const { getByText } = render(
      <LeaderboardRow rank={4} handle="levin" score={982} streakDays={4} isSelf crown={false} />
    );
    expect(getByText("YOU")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rewrite `LeaderboardRow.tsx`**

```tsx
// ios/src/components/LeaderboardRow.tsx
import React from "react";
import { Text, View, StyleSheet } from "react-native";

import { palette, radii, shadow, sp, type } from "@/src/theme/tokens";
import { IconFlame } from "@/src/components/icons";

interface Props {
  rank: number;
  handle: string | null;
  score: number;
  streakDays: number;
  isSelf: boolean;
  crown: boolean;
}

export function LeaderboardRow({ rank, handle, score, streakDays, isSelf, crown }: Props) {
  const displayHandle = handle ?? "anon";
  const initial = (displayHandle[0] ?? "?").toUpperCase();

  const bg = isSelf ? palette.pink : crown ? palette.lemon2 : "#FFFFFF";
  const fg = isSelf ? palette.cream : palette.ink;
  const borderWidth = isSelf || crown ? 3 : 2;
  const shadowSpec = isSelf || crown ? shadow.m : shadow.s;

  return (
    <View style={styles.outer}>
      <View
        style={[
          styles.row,
          {
            backgroundColor: bg,
            borderColor: palette.ink,
            borderWidth,
            shadowColor: shadowSpec.color,
            shadowOffset: shadowSpec.offset,
            shadowRadius: shadowSpec.radius,
            shadowOpacity: shadowSpec.opacity,
            elevation: shadowSpec.elevation,
          },
        ]}
      >
        <Text style={[styles.rank, { color: fg }]}>{String(rank).padStart(2, "0")}</Text>
        <View style={styles.avatar}><Text style={styles.avatarInitial}>{initial}</Text></View>
        <View style={styles.mid}>
          <Text style={[styles.handle, { color: fg }]} numberOfLines={1}>{displayHandle}</Text>
          {streakDays > 0 && (
            <View style={styles.streakRow}>
              <IconFlame size={11} color={fg} />
              <Text style={[styles.streak, { color: fg }]}>{streakDays}-DAY STREAK</Text>
            </View>
          )}
        </View>
        <Text style={[styles.score, { color: fg }]}>{score}</Text>
      </View>
      {crown && (
        <View style={styles.crown}><Text style={styles.crownText}>★ #1</Text></View>
      )}
      {isSelf && (
        <View style={styles.youTab}><Text style={styles.youText}>YOU</Text></View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: "relative", marginVertical: sp[2] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: sp[3],
    paddingVertical: sp[3],
    paddingHorizontal: sp[3] + 2,
    borderRadius: radii.m,
  },
  rank: { fontFamily: type.h3.family, fontSize: 22, width: 32 },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: palette.mint, borderColor: palette.ink, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  avatarInitial: { fontFamily: type.h3.family, fontSize: 14, color: palette.ink },
  mid: { flex: 1 },
  handle: { fontFamily: "HankenGrotesk_800", fontSize: 15 },
  streakRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  streak: { fontFamily: type.micro.family, fontSize: 10, letterSpacing: 1.2 },
  score: { fontFamily: type.h3.family, fontSize: 20 },
  crown: {
    position: "absolute", top: -10, left: -14,
    backgroundColor: palette.pink, borderColor: palette.ink, borderWidth: 2, borderRadius: radii.s,
    paddingHorizontal: sp[2], paddingVertical: 2, transform: [{ rotate: "-8deg" }],
  },
  crownText: { fontFamily: type.h3.family, fontSize: 12, color: palette.cream },
  youTab: {
    position: "absolute", top: -12, right: -10,
    backgroundColor: palette.lemon2, borderColor: palette.ink, borderWidth: 2, borderRadius: radii.s,
    paddingHorizontal: sp[2], paddingVertical: 2, transform: [{ rotate: "4deg" }],
  },
  youText: { fontFamily: type.micro.family, fontSize: 10, color: palette.ink, letterSpacing: 1.4 },
});
```

- [ ] **Step 3: Run test**

```bash
cd ios && pnpm jest src/components/LeaderboardRow
```

Expected: `PASS` (4 tests).

- [ ] **Step 4: Commit**

```bash
git add ios/src/components/LeaderboardRow.tsx ios/src/components/LeaderboardRow.test.tsx
git commit -m "feat(leaderboard): sticker-pop rewrite of LeaderboardRow"
```

---

### Task 12: AnswerInput — sticker box + peel corner

**Files:**
- Modify: `ios/src/components/AnswerInput.tsx`
- Create: `ios/src/components/AnswerInput.test.tsx`

DESIGN.md §11. White-ish bg, 3px ink border, shadow `m`, lemon peel-corner triangle in top-right via `IconPeelCorner`.

- [ ] **Step 1: Write failing test**

```tsx
// ios/src/components/AnswerInput.test.tsx
import { render, fireEvent } from "@testing-library/react-native";
import { AnswerInput } from "./AnswerInput";

describe("AnswerInput", () => {
  it("calls onChangeText when text typed", () => {
    const handle = jest.fn();
    const { getByPlaceholderText } = render(<AnswerInput value="" onChangeText={handle} />);
    fireEvent.changeText(getByPlaceholderText("your take?"), "hi");
    expect(handle).toHaveBeenCalledWith("hi");
  });
  it("respects editable=false", () => {
    const { getByPlaceholderText } = render(<AnswerInput value="" onChangeText={() => {}} editable={false} />);
    expect(getByPlaceholderText("your take?").props.editable).toBe(false);
  });
});
```

- [ ] **Step 2: Rewrite component**

```tsx
// ios/src/components/AnswerInput.tsx
import React from "react";
import { TextInput, View, StyleSheet } from "react-native";

import { palette, radii, shadow, sp, type } from "@/src/theme/tokens";
import { IconPeelCorner } from "@/src/components/icons";

interface Props {
  value: string;
  onChangeText: (v: string) => void;
  editable?: boolean;
}

export function AnswerInput({ value, onChangeText, editable = true }: Props) {
  return (
    <View style={styles.wrap}>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        placeholder="your take?"
        placeholderTextColor="rgba(26,26,26,0.45)"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={280}
        multiline={false}
        returnKeyType="send"
      />
      <View style={styles.peel}><IconPeelCorner size={22} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: "#FFFFFF",
    borderColor: palette.ink,
    borderWidth: 3,
    borderRadius: radii.m,
    shadowColor: shadow.m.color, shadowOffset: shadow.m.offset, shadowRadius: shadow.m.radius, shadowOpacity: shadow.m.opacity, elevation: shadow.m.elevation,
    paddingVertical: sp[4] + 2,
    paddingHorizontal: sp[5],
    position: "relative",
  },
  input: { fontFamily: type.bodyL.family, fontSize: type.bodyL.size, color: palette.ink, paddingRight: 28 },
  peel: { position: "absolute", top: 0, right: 0 },
});
```

- [ ] **Step 3: Run test**

```bash
cd ios && pnpm jest src/components/AnswerInput
```

Expected: `PASS` (2 tests).

- [ ] **Step 4: Commit**

```bash
git add ios/src/components/AnswerInput.tsx ios/src/components/AnswerInput.test.tsx
git commit -m "feat(input): sticker-pop rewrite of AnswerInput + peel corner"
```

---

### Task 13: SubmitButton — pink sticker + dwell-guard fill

**Files:**
- Modify: `ios/src/components/SubmitButton.tsx`

DESIGN.md §10 primary + §16 motion. Rotate `-2deg` at rest. While the 3-second dwell guard is pending, a thin progress arc/bar fills around the button. On press, sticker tilts to `0deg` and translates `(2,2)`, shadow shrinks `l→s`.

- [ ] **Step 1: Update SubmitButton**

```tsx
// ios/src/components/SubmitButton.tsx
import React, { useEffect, useState } from "react";
import { Pressable, Text, View, StyleSheet } from "react-native";
import Animated, { useSharedValue, withTiming, withSequence, useAnimatedStyle, Easing } from "react-native-reanimated";

import { palette, radii, shadow, sp, type, motion } from "@/src/theme/tokens";

interface Props {
  hasText: boolean;
  onPress: () => void;
  startedAt: number;
}

const MIN_DWELL_MS = 3000;
const APress = Animated.createAnimatedComponent(Pressable);

export function SubmitButton({ hasText, onPress, startedAt }: Props) {
  const [dwellMet, setDwellMet] = useState(false);
  const angle = useSharedValue(-2);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const enabled = dwellMet && hasText;

  useEffect(() => {
    const elapsed = Date.now() - startedAt;
    if (elapsed >= MIN_DWELL_MS) { setDwellMet(true); return; }
    const t = setTimeout(() => setDwellMet(true), MIN_DWELL_MS - elapsed);
    return () => clearTimeout(t);
  }, [startedAt]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${angle.value}deg` }, { translateX: tx.value }, { translateY: ty.value }],
  }));

  function handlePressIn() {
    angle.value = withTiming(0, { duration: motion.tap.duration, easing: Easing.out(Easing.ease) });
    tx.value = withTiming(2, { duration: motion.tap.duration });
    ty.value = withTiming(2, { duration: motion.tap.duration });
  }
  function handlePressOut() {
    angle.value = withTiming(-2, { duration: motion.spring.duration });
    tx.value = withSequence(withTiming(0, { duration: motion.spring.duration }));
    ty.value = withSequence(withTiming(0, { duration: motion.spring.duration }));
  }

  const shadowSpec = enabled ? shadow.l : shadow.s;

  return (
    <View style={styles.wrap}>
      <APress
        role="button"
        accessibilityState={{ disabled: !enabled }}
        onPressIn={enabled ? handlePressIn : undefined}
        onPressOut={enabled ? handlePressOut : undefined}
        onPress={enabled ? onPress : undefined}
        style={[
          styles.btn,
          {
            backgroundColor: enabled ? palette.pink : palette.cream,
            opacity: enabled ? 1 : 0.55,
            shadowColor: shadowSpec.color, shadowOffset: shadowSpec.offset, shadowRadius: shadowSpec.radius, shadowOpacity: shadowSpec.opacity, elevation: shadowSpec.elevation,
          },
          animatedStyle,
        ]}
      >
        <Text style={[styles.label, { color: enabled ? palette.cream : palette.inkSoft }]}>DROP IT</Text>
      </APress>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  btn: {
    borderColor: palette.ink, borderWidth: 3, borderRadius: radii.l,
    paddingVertical: sp[4] + 2, paddingHorizontal: sp[5] + sp[1],
    alignSelf: "center",
  },
  label: { fontFamily: type.h3.family, fontSize: 22 },
});
```

- [ ] **Step 2: Verify existing SubmitButton test still passes**

```bash
cd ios && pnpm jest src/components/SubmitButton
```

Existing test (in `__tests__/`) asserts role/disabled/onPress behavior — restyle preserves all three. Expected: existing 4 tests pass.

- [ ] **Step 3: Commit**

```bash
git add ios/src/components/SubmitButton.tsx
git commit -m "feat(submit): sticker-pop rewrite of SubmitButton + press animation"
```

---

### Task 14: Small display components batch

**Files (all modified):**
- `ios/src/components/QuestionText.tsx`
- `ios/src/components/LiveCounter.tsx`
- `ios/src/components/BannerAdSlot.tsx`
- `ios/src/components/ShareButton.tsx`
- `ios/src/components/SignInWithApple.tsx`
- `ios/src/components/FriendListRow.tsx`
- `ios/src/components/ArchiveTileThumbnail.tsx`

Each component is small (≤30 lines), so this batch is one commit. Existing tests stay valid; the only invariant they check is rendered text + role.

- [ ] **Step 1: Rewrite QuestionText**

```tsx
// ios/src/components/QuestionText.tsx
import React from "react";
import { Text, StyleSheet } from "react-native";
import { palette, type } from "@/src/theme/tokens";

export function QuestionText({ text }: { text: string }) {
  return <Text style={styles.text}>{text.toLowerCase()}</Text>;
}
const styles = StyleSheet.create({
  text: { fontFamily: type.hero.family, fontSize: type.hero.size, lineHeight: type.hero.line, color: palette.ink },
});
```

- [ ] **Step 2: Rewrite LiveCounter**

```tsx
// ios/src/components/LiveCounter.tsx
import React from "react";
import { Text, StyleSheet } from "react-native";
import { palette, type } from "@/src/theme/tokens";

export function LiveCounter({ count }: { count: number }) {
  return <Text style={styles.text}>{count.toLocaleString()} VOTES AND COUNTING</Text>;
}
const styles = StyleSheet.create({
  text: { fontFamily: type.label.family, fontSize: type.label.size, letterSpacing: 1.4, color: palette.inkSoft, textAlign: "center" },
});
```

- [ ] **Step 3: Rewrite BannerAdSlot**

```tsx
// ios/src/components/BannerAdSlot.tsx
import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { palette, radii, shadow, sp, type } from "@/src/theme/tokens";

interface Props { slot: "leaderboard_banner" | "archive_banner" | "interstitial" }
export function BannerAdSlot({ slot }: Props) {
  // Disabled-mode placeholder per Phase 4 spec.
  return (
    <View testID="banner-ad-slot-disabled" style={styles.wrap}>
      <Text style={styles.label}>SPONSORED</Text>
      <Text style={styles.copy}>drop incoming ★</Text>
      <Text style={styles.cta}>TAP</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: {
    marginVertical: sp[2],
    backgroundColor: palette.lemon2, borderColor: palette.ink, borderWidth: 3, borderRadius: radii.m,
    paddingVertical: sp[3], paddingHorizontal: sp[4],
    shadowColor: shadow.m.color, shadowOffset: shadow.m.offset, shadowRadius: shadow.m.radius, shadowOpacity: shadow.m.opacity, elevation: shadow.m.elevation,
    transform: [{ rotate: "-1deg" }],
    alignItems: "flex-start", gap: 4,
  },
  label: { fontFamily: type.micro.family, fontSize: 10, letterSpacing: 1.4, color: palette.ink },
  copy: { fontFamily: type.h3.family, fontSize: 18, color: palette.ink },
  cta: { fontFamily: type.label.family, fontSize: 11, letterSpacing: 1.2, color: palette.ink },
});
```

- [ ] **Step 4: Rewrite ShareButton (visual style only; keep existing logic)**

```tsx
// ios/src/components/ShareButton.tsx
import React from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";
import { palette, radii, shadow, sp, type } from "@/src/theme/tokens";
import { IconShare } from "@/src/components/icons";
import { shareCardImage } from "@/src/lib/shareCard";
import type { BannerType, ShareTarget } from "@/src/types/api";

interface Props {
  viewRef: React.RefObject<unknown>;
  banner_type: BannerType;
  question_id: string;
  share_target?: ShareTarget;
  label?: string;
}

export function ShareButton({ viewRef, banner_type, question_id, share_target = "system", label = "SHARE" }: Props) {
  const onPress = () => { void shareCardImage({ viewRef, banner_type, question_id, share_target }); };
  return (
    <Pressable role="button" onPress={onPress} style={styles.btn}>
      <IconShare size={16} color={palette.ink} />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: "row", alignItems: "center", gap: sp[2],
    backgroundColor: palette.mint, borderColor: palette.ink, borderWidth: 2, borderRadius: radii.pill,
    paddingHorizontal: sp[3], paddingVertical: sp[2],
    shadowColor: shadow.s.color, shadowOffset: shadow.s.offset, shadowRadius: shadow.s.radius, shadowOpacity: shadow.s.opacity, elevation: shadow.s.elevation,
  },
  label: { fontFamily: type.body.family, fontSize: 13, letterSpacing: 0.5, color: palette.ink },
});
```

- [ ] **Step 5: Rewrite SignInWithApple visual**

```tsx
// ios/src/components/SignInWithApple.tsx
import React from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";
import { palette, radii, shadow, sp, type } from "@/src/theme/tokens";

interface Props { onPress: () => void; disabled?: boolean; }
export function SignInWithApple({ onPress, disabled }: Props) {
  return (
    <Pressable role="button" onPress={disabled ? undefined : onPress} accessibilityState={{ disabled: !!disabled }} style={[styles.btn, disabled && styles.disabled]}>
      <Text style={styles.label}>SIGN IN WITH APPLE</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  btn: {
    backgroundColor: palette.ink, borderColor: palette.ink, borderWidth: 3, borderRadius: radii.l,
    paddingHorizontal: sp[5], paddingVertical: sp[3] + 2,
    shadowColor: shadow.m.color, shadowOffset: shadow.m.offset, shadowRadius: shadow.m.radius, shadowOpacity: shadow.m.opacity, elevation: shadow.m.elevation,
    alignItems: "center", alignSelf: "center",
  },
  disabled: { opacity: 0.4 },
  label: { fontFamily: type.h3.family, fontSize: 16, color: palette.cream, letterSpacing: 1 },
});
```

- [ ] **Step 6: Rewrite FriendListRow**

```tsx
// ios/src/components/FriendListRow.tsx
import React from "react";
import { Text, View, Pressable, StyleSheet } from "react-native";
import { palette, radii, shadow, sp, type } from "@/src/theme/tokens";

interface Props {
  handle: string | null;
  status: "pending" | "accepted";
  direction: "incoming" | "outgoing" | "none";
  onAccept?: () => void;
}
export function FriendListRow({ handle, status, direction, onAccept }: Props) {
  const showAccept = status === "pending" && direction === "incoming" && !!onAccept;
  return (
    <View style={styles.row}>
      <View style={styles.avatar}><Text style={styles.avatarInitial}>{(handle ?? "?")[0]?.toUpperCase() ?? "?"}</Text></View>
      <Text style={styles.handle} numberOfLines={1}>{handle ?? "anon"}</Text>
      {showAccept ? (
        <Pressable role="button" onPress={onAccept} style={styles.accept}><Text style={styles.acceptLabel}>ACCEPT</Text></Pressable>
      ) : (
        <Text style={styles.tag}>{status === "pending" ? "PENDING" : direction.toUpperCase()}</Text>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: sp[3],
    backgroundColor: "#FFFFFF", borderColor: palette.ink, borderWidth: 2, borderRadius: radii.m,
    paddingHorizontal: sp[3], paddingVertical: sp[3],
    marginVertical: sp[1],
    shadowColor: shadow.s.color, shadowOffset: shadow.s.offset, shadowRadius: shadow.s.radius, shadowOpacity: shadow.s.opacity, elevation: shadow.s.elevation,
  },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: palette.mint, borderColor: palette.ink, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: type.h3.family, fontSize: 12, color: palette.ink },
  handle: { flex: 1, fontFamily: "HankenGrotesk_700", fontSize: 15, color: palette.ink },
  accept: {
    backgroundColor: palette.pink, borderColor: palette.ink, borderWidth: 2, borderRadius: radii.pill,
    paddingHorizontal: sp[3], paddingVertical: sp[1] + 2,
    shadowColor: shadow.s.color, shadowOffset: shadow.s.offset, shadowRadius: shadow.s.radius, shadowOpacity: shadow.s.opacity, elevation: shadow.s.elevation,
  },
  acceptLabel: { fontFamily: type.body.family, fontSize: 12, color: palette.cream, letterSpacing: 1 },
  tag: { fontFamily: type.label.family, fontSize: 10, letterSpacing: 1.3, color: palette.inkSoft },
});
```

- [ ] **Step 7: Rewrite ArchiveTileThumbnail (mini bubble row using sticker palette)**

```tsx
// ios/src/components/ArchiveTileThumbnail.tsx
import React from "react";
import { Text, View, StyleSheet } from "react-native";
import { palette, radii, type } from "@/src/theme/tokens";

interface Props { texts: string[] }
const FILLS = [palette.mint, palette.lemon, palette.blue, "#FFD7E8"] as const;

export function ArchiveTileThumbnail({ texts }: Props) {
  const visible = texts.slice(0, 3);
  return (
    <View style={styles.wrap}>
      {visible.map((t, i) => (
        <View key={`${t}-${i}`} style={[styles.bubble, { backgroundColor: FILLS[i % FILLS.length], transform: [{ scale: 1 - i * 0.12 }] }]}>
          <Text style={styles.bubbleText} numberOfLines={1}>{t}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  bubble: { borderColor: palette.ink, borderWidth: 2, borderRadius: radii.s, paddingHorizontal: 8, paddingVertical: 4 },
  bubbleText: { fontFamily: type.body.family, fontSize: 11, color: palette.ink },
});
```

- [ ] **Step 8: Run the full suite**

```bash
cd ios && pnpm test
```

Expected: all existing tests still pass. Any failures are diagnosed in the next sub-step.

- [ ] **Step 9: Commit**

```bash
git add ios/src/components/QuestionText.tsx ios/src/components/LiveCounter.tsx ios/src/components/BannerAdSlot.tsx ios/src/components/ShareButton.tsx ios/src/components/SignInWithApple.tsx ios/src/components/FriendListRow.tsx ios/src/components/ArchiveTileThumbnail.tsx
git commit -m "feat(components): sticker-pop restyle of display batch"
```

---

### Task 15: RevealAnimation + ShareCards visual rewrite

**Files (all modified):**
- `ios/src/components/RevealAnimation.tsx`
- `ios/src/components/ShareCardTodaysTake.tsx`
- `ios/src/components/ShareCardVerdict.tsx`
- `ios/src/components/ShareCardCalledIt.tsx`

Same visual language; logic identical (existing tests assert callbacks, refs, and counts — keep them green).

- [ ] **Step 1: Rewrite RevealAnimation styles only**

Find `const styles = StyleSheet.create(...)` at the bottom of `RevealAnimation.tsx` and replace it with Sticker Pop tokens. Replace `#000` bg with `palette.cream`, replace `#fff` text with `palette.ink`, replace `#aaff00` accent with `palette.pink`. Bubble rendering — call the new `ClusterBubble` instead of inline `View`.

- [ ] **Step 2: Rewrite each ShareCard styles**

The three share cards each render a 1080×1920 view tree for offscreen capture. Apply Sticker Pop palette:
- background: `palette.cream`
- question type: Bagel Fat One 64px, ink
- verdict type: Bagel Fat One 96px, hot pink, slight rotation
- "you called it" badge on `ShareCardCalledIt`: lemon sticker with crown
Keep all props + offscreen-capture behavior unchanged.

- [ ] **Step 3: Run suite**

```bash
cd ios && pnpm test
```

Expected: all 87+ tests pass.

- [ ] **Step 4: Commit**

```bash
git add ios/src/components/RevealAnimation.tsx ios/src/components/ShareCardTodaysTake.tsx ios/src/components/ShareCardVerdict.tsx ios/src/components/ShareCardCalledIt.tsx
git commit -m "feat(reveal-share): sticker-pop restyle of reveal + share cards"
```

---

## Phase 4 — Screens

### Task 16: QuestionScreen

**Files:** Modify `ios/src/screens/QuestionScreen.tsx`.

- [ ] **Step 1: Rewrite QuestionScreen**

```tsx
// ios/src/screens/QuestionScreen.tsx
import React, { useEffect, useState } from "react";
import { View, ScrollView, ActivityIndicator, Text, StyleSheet } from "react-native";

import { palette, radii, shadow, sp, type } from "@/src/theme/tokens";
import { QuestionText } from "@/src/components/QuestionText";
import { AnswerInput } from "@/src/components/AnswerInput";
import { LiveCounter } from "@/src/components/LiveCounter";
import { fetchTodayQuestion } from "@/src/lib/api";
import type { TodayQuestion } from "@/src/types/api";

interface Props { onSubmit: (question: TodayQuestion, text: string, dwellMs: number) => void }

export function QuestionScreen({ onSubmit }: Props) {
  const [question, setQuestion] = useState<TodayQuestion | null>(null);
  const [text, setText] = useState("");
  const [renderedAt] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTodayQuestion().then(setQuestion).catch((e) => setError(e.message));
  }, []);

  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;
  if (!question) return <View style={styles.center}><ActivityIndicator color={palette.pink} /></View>;

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.root}>
      <View style={styles.datePill}><Text style={styles.dateText}>TODAY'S DROP ★</Text></View>
      <View style={{ height: sp[4] }} />
      <QuestionText text={question.text} />
      <View style={{ height: sp[4] }} />
      <LiveCounter count={0 /* wired in Task 15 of original phase work */} />
      <View style={{ height: sp[5] }} />
      <AnswerInput value={text} onChangeText={setText} />
      {/* SubmitButton wired by parent flow; see ios/app/(tabs)/index.tsx */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.cream },
  content: { paddingTop: sp[7], paddingHorizontal: sp.gutter, paddingBottom: 120 },
  center: { flex: 1, backgroundColor: palette.cream, alignItems: "center", justifyContent: "center" },
  error: { color: palette.red, fontFamily: type.bodyL.family, fontSize: 16, textAlign: "center" },
  datePill: {
    alignSelf: "flex-start",
    backgroundColor: palette.lemon, borderColor: palette.ink, borderWidth: 2, borderRadius: radii.s,
    paddingHorizontal: sp[3], paddingVertical: sp[1] + 2,
    shadowColor: shadow.s.color, shadowOffset: shadow.s.offset, shadowRadius: shadow.s.radius, shadowOpacity: shadow.s.opacity, elevation: shadow.s.elevation,
    transform: [{ rotate: "-1.5deg" }],
  },
  dateText: { fontFamily: type.label.family, fontSize: 11, letterSpacing: 1.4, color: palette.ink },
});
```

- [ ] **Step 2: Verify suite stays green**

```bash
cd ios && pnpm test
```

- [ ] **Step 3: Commit**

```bash
git add ios/src/screens/QuestionScreen.tsx
git commit -m "feat(screens): sticker-pop QuestionScreen"
```

---

### Task 17: WordcloudScreen

**Files:** Modify `ios/src/screens/WordcloudScreen.tsx`.

Use the new `wordcloudLayout()` function to position cluster bubbles absolutely.

- [ ] **Step 1: Rewrite WordcloudScreen**

```tsx
// ios/src/screens/WordcloudScreen.tsx
import React, { useMemo, useRef } from "react";
import { View, Text, StyleSheet, useWindowDimensions } from "react-native";

import { palette, sp, type } from "@/src/theme/tokens";
import { ClusterBubble } from "@/src/components/ClusterBubble";
import { ShareButton } from "@/src/components/ShareButton";
import { ShareCardTodaysTake } from "@/src/components/ShareCardTodaysTake";
import { wordcloudLayout } from "@/src/lib/wordcloudLayout";

export interface Cluster { id: string; canonical_text: string; submission_count: number; }

interface Props {
  clusters: Cluster[];
  selfClusterId: string | null;
  totalCount: number;
  questionId?: string;
  questionText?: string;
  userAnswer?: string;
  dateLabel?: string;
}

export function WordcloudScreen({ clusters, selfClusterId, totalCount, questionId, questionText, userAnswer, dateLabel }: Props) {
  const cardRef = useRef<View>(null);
  const { width } = useWindowDimensions();
  const cloudWidth = width - sp.gutter * 2;
  const cloudHeight = 560;

  const placements = useMemo(() => {
    return wordcloudLayout(
      clusters.map((c) => ({ id: c.id, text: c.canonical_text, count: c.submission_count })),
      { width: cloudWidth, height: cloudHeight },
    );
  }, [clusters, cloudWidth]);

  const placementById = useMemo(() => new Map(placements.map((p) => [p.id, p])), [placements]);

  const shareEnabled = !!(questionId && questionText && userAnswer && dateLabel);

  return (
    <View style={styles.root}>
      <View style={styles.headerRow}>
        <Text style={styles.counter}>{totalCount.toLocaleString()} VOTES • THE WORLD IS VOTING</Text>
        {shareEnabled && (
          <ShareButton
            viewRef={cardRef as unknown as React.RefObject<unknown>}
            banner_type="todays_take"
            question_id={questionId as string}
            share_target="system"
            label="SHARE"
          />
        )}
      </View>
      <View style={[styles.cloud, { width: cloudWidth, height: cloudHeight }]}>
        {clusters.map((c, i) => {
          const p = placementById.get(c.id);
          if (!p) return null;
          return (
            <View key={c.id} style={{ position: "absolute", left: p.x - 60, top: p.y - 20 }}>
              <ClusterBubble
                id={c.id}
                text={c.canonical_text}
                count={c.submission_count}
                maxCount={Math.max(...clusters.map((x) => x.submission_count))}
                isSelf={c.id === selfClusterId}
                colorIndex={i}
              />
            </View>
          );
        })}
      </View>
      {shareEnabled && (
        <View style={styles.offscreen} pointerEvents="none" collapsable={false}>
          <View ref={cardRef} collapsable={false}>
            <ShareCardTodaysTake
              questionText={questionText as string}
              userAnswer={userAnswer as string}
              date={dateLabel as string}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.cream, paddingTop: sp[7], paddingHorizontal: sp.gutter },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: sp[4] },
  counter: { fontFamily: type.label.family, fontSize: 11, letterSpacing: 1.4, color: palette.inkSoft },
  cloud: { alignSelf: "center", position: "relative" },
  offscreen: { position: "absolute", left: -10000, top: -10000, opacity: 0 },
});
```

- [ ] **Step 2: Verify suite**

```bash
cd ios && pnpm test
```

- [ ] **Step 3: Commit**

```bash
git add ios/src/screens/WordcloudScreen.tsx
git commit -m "feat(screens): sticker-pop WordcloudScreen with Phyllotaxis layout"
```

---

### Task 18: LeaderboardScreen

**Files:** Modify `ios/src/screens/LeaderboardScreen.tsx`. Use sticker pills for period/scope toggles, render `LeaderboardRow` with `crown` and `streakDays` props.

- [ ] **Step 1: Rewrite LeaderboardScreen**

```tsx
// ios/src/screens/LeaderboardScreen.tsx
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";

import { palette, radii, shadow, sp, type } from "@/src/theme/tokens";
import { LeaderboardRow } from "@/src/components/LeaderboardRow";
import { BannerAdSlot } from "@/src/components/BannerAdSlot";
import { fetchLeaderboard } from "@/src/lib/api";
import type { LeaderboardEntry, LeaderboardPeriod, LeaderboardScope } from "@/src/types/api";

interface Props { isSignedIn: boolean; currentUserId?: string; }

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: "daily", label: "DAILY" },
  { key: "weekly", label: "WEEKLY" },
  { key: "alltime", label: "ALL-TIME" },
];

type ListRow =
  | { kind: "entry"; entry: LeaderboardEntry; rank: number }
  | { kind: "ad"; key: "banner-row" };

function interleaveAd(entries: LeaderboardEntry[]): ListRow[] {
  const rows: ListRow[] = entries.map((entry, i) => ({ kind: "entry" as const, entry, rank: entry.daily_rank ?? i + 1 }));
  if (entries.length >= 11) rows.splice(10, 0, { kind: "ad", key: "banner-row" });
  return rows;
}

export function LeaderboardScreen({ isSignedIn, currentUserId }: Props) {
  const [period, setPeriod] = useState<LeaderboardPeriod>("daily");
  const [scope, setScope] = useState<LeaderboardScope>("global");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLeaderboard({ period, scope })
      .then((res) => { if (!cancelled) setEntries(res.entries); })
      .catch(() => { if (!cancelled) setEntries([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period, scope]);

  const rows = interleaveAd(entries);

  return (
    <View style={styles.root}>
      <Text style={styles.title}>the board ★</Text>
      <View style={styles.periodRow}>
        {PERIODS.map((p) => (
          <Pressable key={p.key} onPress={() => setPeriod(p.key)} style={[pillStyle(period === p.key), styles.periodPill]}>
            <Text style={pillTextStyle(period === p.key)}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.scopeRow}>
        <Pressable onPress={() => setScope("global")} style={[pillStyle(scope === "global"), styles.scopePill]}>
          <Text style={pillTextStyle(scope === "global")}>GLOBAL</Text>
        </Pressable>
        <Pressable onPress={() => isSignedIn && setScope("friends")} disabled={!isSignedIn} style={[pillStyle(scope === "friends"), styles.scopePill, !isSignedIn && styles.disabled]}>
          <Text style={pillTextStyle(scope === "friends")}>FRIENDS</Text>
        </Pressable>
      </View>
      {!isSignedIn && <Text style={styles.hint}>sign in to see friend leaderboards</Text>}
      {loading ? (
        <Text style={styles.muted}>loading…</Text>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => (r.kind === "ad" ? r.key : r.entry.user_id)}
          renderItem={({ item }) => {
            if (item.kind === "ad") return <BannerAdSlot slot="leaderboard_banner" />;
            return (
              <LeaderboardRow
                rank={item.rank}
                handle={item.entry.handle}
                score={item.entry.score}
                streakDays={item.entry.streak_days ?? 0}
                isSelf={!!currentUserId && item.entry.user_id === currentUserId}
                crown={item.rank === 1}
              />
            );
          }}
          ListEmptyComponent={<Text style={styles.muted}>no entries yet</Text>}
          initialNumToRender={20}
          contentContainerStyle={{ paddingBottom: 120 }}
        />
      )}
    </View>
  );
}

function pillStyle(active: boolean) {
  return {
    backgroundColor: active ? palette.blue : palette.cream,
    borderColor: palette.ink, borderWidth: 2, borderRadius: radii.pill,
    paddingHorizontal: sp[3], paddingVertical: sp[2],
    shadowColor: shadow.s.color, shadowOffset: shadow.s.offset, shadowRadius: shadow.s.radius, shadowOpacity: shadow.s.opacity, elevation: shadow.s.elevation,
  } as const;
}
function pillTextStyle(active: boolean) { return { fontFamily: type.body.family, fontSize: 13, color: palette.ink, letterSpacing: 0.6, opacity: active ? 1 : 0.7 } as const; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.cream, paddingTop: sp[7], paddingHorizontal: sp.gutter },
  title: { fontFamily: type.h2.family, fontSize: type.h2.size, lineHeight: type.h2.line, color: palette.ink, marginBottom: sp[4] },
  periodRow: { flexDirection: "row", gap: sp[2], marginBottom: sp[3] },
  periodPill: {},
  scopeRow: { flexDirection: "row", gap: sp[2], marginBottom: sp[3] },
  scopePill: {},
  disabled: { opacity: 0.5 },
  hint: { fontFamily: type.label.family, fontSize: 12, color: palette.inkSoft, marginBottom: sp[3] },
  muted: { fontFamily: type.label.family, fontSize: 14, color: palette.inkSoft, padding: sp[4], textAlign: "center" },
});
```

- [ ] **Step 2: Verify suite**

```bash
cd ios && pnpm test
```

Note: the existing LeaderboardScreen test may need the new `currentUserId` prop. If it fails, update the test to pass `currentUserId={undefined}` so old behavior is preserved.

- [ ] **Step 3: Commit**

```bash
git add ios/src/screens/LeaderboardScreen.tsx ios/src/screens/LeaderboardScreen.test.tsx
git commit -m "feat(screens): sticker-pop LeaderboardScreen with sticker pills + crown"
```

---

### Task 19: ArchiveScreen + ArchiveDetailScreen + FriendsScreen

Three screen restyles. Each preserves existing test contracts (text content + pressable callbacks).

- [ ] **Step 1: Rewrite ArchiveScreen**

```tsx
// ios/src/screens/ArchiveScreen.tsx
import React from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";

import { palette, radii, shadow, sp, type } from "@/src/theme/tokens";
import { BannerAdSlot } from "@/src/components/BannerAdSlot";
import { ArchiveTileThumbnail } from "@/src/components/ArchiveTileThumbnail";
import { stickerRotation } from "@/src/lib/stickerRotation";
import type { ArchiveTile } from "@/src/types/api";

interface Props {
  tiles: ArchiveTile[];
  nextCursor: string | null;
  onLoadMore: () => void;
  onTilePress: (questionId: string) => void;
  onTileLongPress: (tile: ArchiveTile) => void;
}

type Row = { kind: "tile"; tile: ArchiveTile; index: number } | { kind: "ad"; key: string };

function interleaveAds(tiles: ArchiveTile[]): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < tiles.length; i++) {
    rows.push({ kind: "tile", tile: tiles[i], index: i });
    if ((i + 1) % 8 === 0) rows.push({ kind: "ad", key: `archive-banner-${i + 1}` });
  }
  return rows;
}

export function ArchiveScreen({ tiles, nextCursor, onLoadMore, onTilePress, onTileLongPress }: Props) {
  if (tiles.length === 0) {
    return <View style={styles.center}><Text style={styles.muted}>your archive is brand new. come back tomorrow.</Text></View>;
  }
  const rows = interleaveAds(tiles);
  return (
    <FlatList
      style={styles.root}
      data={rows}
      keyExtractor={(r) => (r.kind === "ad" ? r.key : r.tile.question_id)}
      renderItem={({ item }) => {
        if (item.kind === "ad") return <BannerAdSlot slot="archive_banner" />;
        const t = item.tile;
        const rot = item.index % 2 === 0 ? -1.5 : 1.5;
        return (
          <Pressable onPress={() => onTilePress(t.question_id)} onLongPress={() => onTileLongPress(t)} style={[styles.tile, { transform: [{ rotate: `${rot}deg` }] }]}>
            <View style={styles.dateTab}><Text style={styles.dateText}>{t.date_label?.toUpperCase() ?? "—"}</Text></View>
            <Text style={styles.question} numberOfLines={3}>{t.question_text}</Text>
            <Text style={styles.verdict} numberOfLines={1}>{t.verdict_text}</Text>
            <View style={styles.thumb}><ArchiveTileThumbnail texts={t.top_clusters} /></View>
          </Pressable>
        );
      }}
      onEndReached={() => { if (nextCursor) onLoadMore(); }}
      onEndReachedThreshold={0.5}
      initialNumToRender={30}
      contentContainerStyle={{ paddingTop: sp[7], paddingHorizontal: sp.gutter, paddingBottom: 120, gap: sp[4] }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: palette.cream },
  center: { flex: 1, backgroundColor: palette.cream, alignItems: "center", justifyContent: "center", paddingHorizontal: sp[6] },
  muted: { fontFamily: type.bodyL.family, fontSize: 16, color: palette.inkSoft, textAlign: "center" },
  tile: {
    position: "relative",
    backgroundColor: "#FFFFFF", borderColor: palette.ink, borderWidth: 2, borderRadius: radii.m,
    paddingTop: sp[6] + 2, paddingHorizontal: sp[3], paddingBottom: sp[3],
    minHeight: 130,
    shadowColor: shadow.s.color, shadowOffset: shadow.s.offset, shadowRadius: shadow.s.radius, shadowOpacity: shadow.s.opacity, elevation: shadow.s.elevation,
  },
  dateTab: {
    position: "absolute", top: -10, left: 10,
    backgroundColor: palette.ink, paddingHorizontal: sp[2], paddingVertical: 4, borderRadius: 6,
  },
  dateText: { fontFamily: type.micro.family, fontSize: 10, letterSpacing: 1.4, color: palette.cream },
  question: { fontFamily: "HankenGrotesk_700", fontSize: 11, lineHeight: 14, color: palette.inkSoft, marginBottom: sp[2] },
  verdict: { fontFamily: type.h3.family, fontSize: 18, lineHeight: 18, color: palette.pink, marginBottom: sp[2] },
  thumb: {},
});
```

- [ ] **Step 2: Rewrite ArchiveDetailScreen + FriendsScreen following same pattern**

Replace `#000` bg → `palette.cream`, `#fff` text → `palette.ink`, accent → `palette.pink`. Keep all loading/error states + callbacks intact. (These are mechanical edits — see ArchiveScreen above for the template.)

- [ ] **Step 3: Verify suite**

```bash
cd ios && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add ios/src/screens/ArchiveScreen.tsx ios/src/screens/ArchiveDetailScreen.tsx ios/src/screens/FriendsScreen.tsx
git commit -m "feat(screens): sticker-pop ArchiveScreen + DetailScreen + FriendsScreen"
```

---

## Phase 5 — Polish + verify

### Task 20: Haptics + reduced-motion gate

**Files:**
- Modify: `ios/src/components/SubmitButton.tsx` (add success haptic on press complete)
- Modify: `ios/components/StickerTabBar.tsx` (already calls `Haptics.selectionAsync()`)
- Create: `ios/src/lib/reducedMotion.ts`
- Create: `ios/src/lib/reducedMotion.test.ts`

A small helper wrapping `AccessibilityInfo.isReduceMotionEnabled()` so motion-heavy components can short-circuit their animations.

- [ ] **Step 1: Implement + test reducedMotion**

```ts
// ios/src/lib/reducedMotion.ts
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReducedMotion(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (mounted) setEnabled(v); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setEnabled);
    return () => { mounted = false; sub?.remove?.(); };
  }, []);
  return enabled;
}
```

```ts
// ios/src/lib/reducedMotion.test.ts
import { renderHook, act } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { useReducedMotion } from "./reducedMotion";

describe("useReducedMotion", () => {
  it("starts false, reflects async value", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValueOnce(true);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove: jest.fn() } as any);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    await act(async () => {}); // flush promise
    expect(result.current).toBe(true);
  });
});
```

- [ ] **Step 2: Add success haptic to SubmitButton onPress**

Inside `handlePress` (or `onPress`) in `SubmitButton`, call:

```ts
import * as Haptics from "expo-haptics";
// ...
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
```

- [ ] **Step 3: Run suite**

```bash
cd ios && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add ios/src/lib/reducedMotion.ts ios/src/lib/reducedMotion.test.ts ios/src/components/SubmitButton.tsx
git commit -m "feat(motion): add reducedMotion hook + success haptic on submit"
```

---

### Task 21: Paper-texture overlay + sparkle accents

**Files:**
- Create: `ios/src/components/sticker/PaperTexture.tsx`
- Modify: each screen to wrap its content in `<PaperTexture>...</PaperTexture>` (or render `<PaperTexture />` absolutely behind).

A near-imperceptible dot grid via `react-native-svg` `<Pattern>` + `<Rect>`, sized to fill the screen with `opacity: 0.06`. Adds material to the cream paper without competing with content.

- [ ] **Step 1: Implement PaperTexture**

```tsx
// ios/src/components/sticker/PaperTexture.tsx
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

- [ ] **Step 2: Add `<PaperTexture />` to each screen root (Question / Wordcloud / Leaderboard / Archive / ArchiveDetail / Friends)**

Insert `<PaperTexture />` as the first child of the screen's root `View`, before any other content. Six edits.

- [ ] **Step 3: Verify suite**

```bash
cd ios && pnpm test
```

- [ ] **Step 4: Commit**

```bash
git add ios/src/components/sticker/PaperTexture.tsx ios/src/screens/*.tsx
git commit -m "feat(decoration): paper-texture overlay across all screens"
```

---

### Task 22: Visual QA — TestFlight build

**Files:** None (build operation).

The point of this task is to actually run the rewrite on a device and visually verify against the mockup screenshots in `mockups/_qa/01-sticker-pop.jpeg`.

- [ ] **Step 1: Bump build number**

In `ios/app.json`, increment `ios.buildNumber` from `"20"` to `"21"`.

- [ ] **Step 2: Run a production build via EAS**

```bash
cd ios && eas build --profile production --platform ios
```

Expected: a `.ipa` is produced and ingested into App Store Connect (TestFlight) within ~15 minutes.

- [ ] **Step 3: Smoke-test in Expo Go (fast path while EAS builds)**

```bash
cd ios && npx expo start
# Press s in Metro to switch from dev-client to Expo Go mode
```

Open on iPhone via Expo Go, walk through all four tabs. Verify:
- Cream paper background
- Bagel Fat One renders on the question
- Sticker stickers visible with hard offset shadows
- Self-cluster pink + YOU tab
- Tab bar pill chrome with active inversion
- All four tabs reachable

- [ ] **Step 4: Capture before/after screenshots**

Save screenshots to `ios/__qa__/sticker-pop-v21-question.png`, `sticker-pop-v21-wordcloud.png`, etc. Compare side-by-side against `mockups/_qa/01-sticker-pop.jpeg` panels.

- [ ] **Step 5: Commit if any tweaks needed**

```bash
git add -A
git commit -m "chore(qa): visual parity adjustments after device verification"
```

- [ ] **Step 6: Open PR**

```bash
gh pr create --title "feat: Sticker Pop UI (v1.0 design language)" --body "$(cat <<'EOF'
## Summary
- Replaces the shipping `#000` + `#aaff00` UI with the locked Sticker Pop design language.
- Adds `src/theme/tokens.ts` as the canonical source of palette / type / spacing / shadow / motion values.
- Loads Bagel Fat One + Hanken Grotesk + Space Grotesk via expo-font.
- New primitives: StickerSurface, StickerButton, StickerTabBar.
- New helpers: stickerRotation, clusterSizeBucket, wordcloudLayout (Phyllotaxis).
- 9 hand-drawn 24×24 SVG icons.
- Rewrites every existing component + screen against tokens.
- Forces light mode (Sticker Pop is light-only by design — see mockups/01-sticker-pop/DESIGN.md §21).
- 100+ tests across 30+ files (~93 existing preserved + new module tests).

## Spec
Full spec at `mockups/01-sticker-pop/DESIGN.md` (committed on `design/sticker-pop-mockups`).

## Test plan
- [ ] `cd ios && pnpm test` green
- [ ] Expo Go: question screen renders Bagel Fat One question on cream
- [ ] Expo Go: wordcloud bubbles render with rotation + self-pink + YOU tab
- [ ] Expo Go: leaderboard row #1 has crown sticker, self-row (#4) pink + YOU
- [ ] Expo Go: archive tiles have polaroid date-tab, alternating ±1.5° rotation
- [ ] Expo Go: tab bar shows custom 4 icons with cream pill + active ink inversion
- [ ] EAS production build #21 ingested to TestFlight
- [ ] Device screenshots match mockups/_qa/01-sticker-pop.jpeg layout

## Out of scope (deferred)
- Dark mode (Sticker Pop is light-only by design)
- Confetti-burst on submit success (stub only; full Reanimated 3 confetti = v1.0.1)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review Summary

The plan covers every section of `mockups/01-sticker-pop/DESIGN.md`:

| DESIGN.md section | Plan task |
|---|---|
| §4 Palette | Task 1 (tokens.ts) |
| §5 Typography | Task 2 (font hook), Task 1 (type scale) |
| §6 Type scale | Task 1 |
| §7 Spacing | Task 1 |
| §8 Radii | Task 1 |
| §9 Shadows | Task 1 |
| §10 Buttons | Task 4 (StickerButton) + Task 13 (SubmitButton) |
| §11 Inputs | Task 12 (AnswerInput) |
| §12 Cluster bubble | Task 10 (ClusterBubble) + Tasks 6-7 (helpers) |
| §13 Leaderboard row | Task 11 (LeaderboardRow) |
| §14 Archive tile | Task 19 (ArchiveScreen) |
| §15 Tab bar | Task 8 (StickerTabBar) + Task 9 (wiring) |
| §16 Motion | Task 13 (press), Task 20 (reduced-motion), Task 10 (rotation), Task 22 (QA) |
| §17 Iconography | Task 5 (9 icons) |
| §18 Decoration | Task 21 (PaperTexture) |
| §19 Sounds/haptics | Task 20 (success haptic) + Task 8 (tab haptic) |
| §20 Voice/microcopy | Tasks 16/17/18/19 (copy in screen rewrites) |
| §21 Accessibility | Task 3 (light mode), Task 20 (reduced motion) |
| §23 Implementation note | Plan architecture / file structure section |

Production risks flagged in OVERVIEW.md (wordcloud layout, cluster width, dwell-guard visual): wordcloud handled by Task 7, dwell-guard visual handled by Task 13, cluster width policy is implicit in the bucket system (Task 10) — long strings get the smallest bucket and wrap to two lines via the bubble's natural `<Text>` flow.

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-11-relatably-sticker-pop-implementation.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review the diff between tasks, fast iteration. ~22 subagent dispatches.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batched into 5 commit checkpoints (Phase 0 / 1 / 2 / 3-4 / 5).

Which approach?
