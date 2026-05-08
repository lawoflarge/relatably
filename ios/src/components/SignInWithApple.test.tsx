import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { SignInWithApple } from "./SignInWithApple";

jest.mock("@/src/lib/auth", () => ({
  signInWithApple: jest.fn(),
}));

import * as authMod from "@/src/lib/auth";

describe("SignInWithApple", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders an Apple sign-in button", () => {
    const { getByRole } = render(<SignInWithApple onSignedIn={() => {}} />);
    expect(getByRole("button")).toBeTruthy();
  });

  it("calls signInWithApple on press and invokes onSignedIn with the uid", async () => {
    (authMod.signInWithApple as jest.Mock).mockResolvedValueOnce({ uid: "user-z" });
    const onSignedIn = jest.fn();
    const { getByRole } = render(<SignInWithApple onSignedIn={onSignedIn} />);
    fireEvent.press(getByRole("button"));
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith("user-z"));
  });

  it("calls onError when sign-in fails", async () => {
    (authMod.signInWithApple as jest.Mock).mockRejectedValueOnce(new Error("user-cancelled"));
    const onError = jest.fn();
    const { getByRole } = render(<SignInWithApple onSignedIn={() => {}} onError={onError} />);
    fireEvent.press(getByRole("button"));
    await waitFor(() => expect(onError).toHaveBeenCalled());
  });
});
