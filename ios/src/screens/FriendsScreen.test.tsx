import { render, waitFor, fireEvent } from "@testing-library/react-native";
import { FriendsScreen } from "./FriendsScreen";

jest.mock("@/src/lib/api", () => ({
  fetchFriends: jest.fn(),
  acceptFriend: jest.fn(),
}));

import { fetchFriends, acceptFriend } from "@/src/lib/api";

describe("FriendsScreen", () => {
  beforeEach(() => jest.clearAllMocks());

  it("shows sign-in hint when not signed in", () => {
    const { getByText } = render(<FriendsScreen isSignedIn={false} />);
    expect(getByText(/sign in/i)).toBeTruthy();
  });

  it("renders friendships from API", async () => {
    (fetchFriends as jest.Mock).mockResolvedValue({
      friendships: [
        { id: "f1", friend_user_id: "u-2", handle: "alice", locale: "en", status: "accepted", direction: "outgoing" },
      ],
    });
    const { getByText } = render(<FriendsScreen isSignedIn={true} />);
    await waitFor(() => expect(getByText("alice")).toBeTruthy());
  });

  it("calls acceptFriend on incoming-pending row Accept", async () => {
    (fetchFriends as jest.Mock).mockResolvedValueOnce({
      friendships: [
        { id: "f2", friend_user_id: "u-3", handle: "bob", locale: "de", status: "pending", direction: "incoming" },
      ],
    });
    (fetchFriends as jest.Mock).mockResolvedValueOnce({ friendships: [] });
    (acceptFriend as jest.Mock).mockResolvedValue({ id: "f2", status: "accepted" });
    const { getByText, findByText } = render(<FriendsScreen isSignedIn={true} />);
    fireEvent.press(await findByText("ACCEPT"));
    await waitFor(() => expect(acceptFriend).toHaveBeenCalledWith("f2"));
  });
});
