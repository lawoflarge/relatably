import { render, fireEvent } from "@testing-library/react-native";

jest.mock("@/src/lib/api", () => ({
  blockUser: jest.fn(),
  removeFriend: jest.fn(),
}));

import { FriendListRow } from "./FriendListRow";

const baseFriendship = {
  id: "f1",
  friend_user_id: "u-2",
  handle: "alice",
  locale: "en",
  status: "accepted" as const,
  direction: "outgoing" as const,
};

describe("FriendListRow", () => {
  it("renders the handle", () => {
    const { getByText } = render(<FriendListRow friendship={baseFriendship} />);
    expect(getByText("alice")).toBeTruthy();
  });

  it("falls back to @<short-uid> when handle is null", () => {
    const f = { ...baseFriendship, handle: null };
    const { getByText } = render(<FriendListRow friendship={f} />);
    expect(getByText(/@u-2/)).toBeTruthy();
  });

  it("shows ACCEPT button only when onAccept provided", () => {
    const onAccept = jest.fn();
    const { getByText, queryByText, rerender } = render(
      <FriendListRow friendship={baseFriendship} onAccept={onAccept} />,
    );
    fireEvent.press(getByText("ACCEPT"));
    expect(onAccept).toHaveBeenCalled();

    rerender(<FriendListRow friendship={baseFriendship} />);
    expect(queryByText("ACCEPT")).toBeNull();
  });
});
