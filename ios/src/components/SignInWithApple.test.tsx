import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { Platform } from "react-native";

jest.mock("@/src/lib/auth", () => ({
  signInWithApple: jest.fn(),
}));

// Native AppleAuthenticationButton is a NativeComponent that jest-expo doesn't
// render. Stub it as a press-forwarding View so the wrapper's onPress wiring
// remains testable. Production iOS keeps the real native component (with
// Apple's logo + label) per HIG Guideline 4.
jest.mock("expo-apple-authentication", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) =>
      React.createElement(View, { testID: "siwa-native-button", onTouchEnd: onPress }),
    AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
    AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
  };
});

import { SignInWithApple } from "./SignInWithApple";
import * as authMod from "@/src/lib/auth";

describe("SignInWithApple", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Force iOS path so the native button renders in tests.
    (Platform as { OS: string }).OS = "ios";
  });

  it("renders the native Apple Sign-in button", () => {
    const { getByTestId } = render(<SignInWithApple onSignedIn={() => {}} />);
    expect(getByTestId("siwa-native-button")).toBeTruthy();
  });

  it("calls signInWithApple on press and invokes onSignedIn with the uid", async () => {
    (authMod.signInWithApple as jest.Mock).mockResolvedValueOnce({ uid: "user-z" });
    const onSignedIn = jest.fn();
    const { getByTestId } = render(<SignInWithApple onSignedIn={onSignedIn} />);
    fireEvent(getByTestId("siwa-native-button"), "touchEnd");
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith("user-z"));
  });

  it("calls onError when sign-in fails", async () => {
    (authMod.signInWithApple as jest.Mock).mockRejectedValueOnce(new Error("user-cancelled"));
    const onError = jest.fn();
    const { getByTestId } = render(<SignInWithApple onSignedIn={() => {}} onError={onError} />);
    fireEvent(getByTestId("siwa-native-button"), "touchEnd");
    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});
