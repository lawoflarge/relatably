import { render, fireEvent } from "@testing-library/react-native";
import { FriendListRow } from "./FriendListRow";

describe("FriendListRow", () => {
  it("renders accepted friend with handle, no Accept button", () => {
    const { getByText, queryByText } = render(
      <FriendListRow id="f1" handle="@friend1" status="accepted" />,
    );
    expect(getByText("@friend1")).toBeTruthy();
    expect(queryByText(/accept/i)).toBeNull();
  });

  it("renders pending incoming with Accept button", () => {
    const onAccept = jest.fn();
    const { getByText } = render(
      <FriendListRow id="f1" handle="@friend1" status="pending_incoming" onAccept={onAccept} />,
    );
    fireEvent.press(getByText(/accept/i));
    expect(onAccept).toHaveBeenCalledWith("f1");
  });

  it("renders pending outgoing as 'Sent'", () => {
    const { getByText } = render(
      <FriendListRow id="f1" handle="@friend1" status="pending_outgoing" />,
    );
    expect(getByText(/sent/i)).toBeTruthy();
  });
});
