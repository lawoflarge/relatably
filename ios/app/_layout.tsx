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
