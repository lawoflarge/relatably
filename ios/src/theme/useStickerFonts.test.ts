import { renderHook } from "@testing-library/react-native";

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
