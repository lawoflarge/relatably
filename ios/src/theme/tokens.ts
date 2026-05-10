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
