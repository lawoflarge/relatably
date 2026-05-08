import { render, fireEvent, waitFor } from "@testing-library/react-native";
import { FriendsScreen } from "./FriendsScreen";

jest.mock("@/src/lib/api", () => ({
  fetchFriends: jest.fn(),
  acceptFriend: jest.fn(),
  removeFriend: jest.fn(),
  requestFriend: jest.fn(),
}));

import * as apiMod from "@/src/lib/api";

describe("FriendsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("when not signed in: prompts to sign in", () => {
    const { getByText } = render(<FriendsScreen isSignedIn={false} myUid={null} />);
    expect(getByText(/sign in/i)).toBeTruthy();
  });

  it("fetches friends on mount", async () => {
    (apiMod.fetchFriends as jest.Mock).mockResolvedValueOnce({
      friendships: [
        { id: "f1", requester_id: "me", accepter_id: "other-1", status: "accepted" },
      ],
    });
    render(<FriendsScreen isSignedIn={true} myUid="me" />);
    await waitFor(() => expect(apiMod.fetchFriends).toHaveBeenCalled());
  });

  it("accepting a pending request calls acceptFriend", async () => {
    (apiMod.fetchFriends as jest.Mock).mockResolvedValue({
      friendships: [
        { id: "f1", requester_id: "other-1", accepter_id: "me", status: "pending" },
      ],
    });
    (apiMod.acceptFriend as jest.Mock).mockResolvedValue({ id: "f1", status: "accepted" });
    const { findByText } = render(<FriendsScreen isSignedIn={true} myUid="me" />);
    const btn = await findByText(/accept/i);
    fireEvent.press(btn);
    await waitFor(() => expect(apiMod.acceptFriend).toHaveBeenCalledWith("f1"));
  });
});
