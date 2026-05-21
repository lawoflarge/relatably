import { useState } from "react";
import { Platform, View, StyleSheet } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { signInWithApple } from "@/src/lib/auth";

interface Props {
  onSignedIn: (uid: string) => void;
  onError?: (err: unknown) => void;
}

// Apple's HIG (Guideline 4) requires Sign in with Apple to render the
// official Apple-logo button. expo-apple-authentication's
// AppleAuthenticationButton wraps the native ASAuthorizationAppleIDButton
// (iOS) which draws the logo, label, and padding to Apple's exact spec.
//
// Width/height: HIG minimum is 140x30, maximum width is the parent's. We use
// a generous 240x48 to match the surrounding Sticker Pop pill scale.
// Per Expo docs, style MUST NOT include backgroundColor or borderRadius.
export function SignInWithApple({ onSignedIn, onError }: Props) {
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { uid } = await signInWithApple();
      onSignedIn(uid);
    } catch (err) {
      onError?.(err);
    } finally {
      setBusy(false);
    }
  };

  // Native button only exists on iOS. On other platforms (Android, web in dev
  // mode, jest) render a tappable fallback so tests/dev still work.
  if (Platform.OS === "ios") {
    return (
      <View accessibilityRole="button" style={styles.wrap}>
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={12}
          style={styles.button}
          onPress={handlePress}
        />
      </View>
    );
  }

  return <View accessibilityRole="button" testID="siwa-fallback" style={styles.wrap} />;
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "center" },
  button: { width: 240, height: 48 },
});
