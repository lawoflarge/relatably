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
