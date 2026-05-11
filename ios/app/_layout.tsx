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
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: "modal", title: "Modal" }} />
        </Stack>
        <StatusBar style="dark" />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
