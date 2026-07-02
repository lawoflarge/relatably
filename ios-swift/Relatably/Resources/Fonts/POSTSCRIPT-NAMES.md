# Bundled fonts — PostScript names

Verified with fontTools (`TTFont(f)['name'].getDebugName(6)`) on 2026-07-02.
Source: `ios/node_modules/@expo-google-fonts/…` per `docs/superpowers/plans/rn-extraction/tokens-fonts-texture.md` §2b.
Use the PostScript name in `Font.custom(_:size:)` / `UIFont(name:)`.

| Bundled file | PostScript name | RN fontFamily key |
|---|---|---|
| BagelFatOne-Regular.ttf | `BagelFatOne-Regular` | `BagelFatOne` |
| HankenGrotesk-Bold.ttf | `HankenGrotesk-Bold` | `HankenGrotesk_700` |
| HankenGrotesk-ExtraBold.ttf | `HankenGrotesk-ExtraBold` | `HankenGrotesk_800` |
| SpaceGrotesk-SemiBold.ttf | `SpaceGrotesk-SemiBold` | `SpaceGrotesk_600` |
| SpaceGrotesk-Bold.ttf | `SpaceGrotesk-Bold` | `SpaceGrotesk_700` |

Excluded (loaded by RN but never rendered, per report §2b): `HankenGrotesk_500`, `SpaceGrotesk_500`.
