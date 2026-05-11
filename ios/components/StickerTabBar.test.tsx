import { fireEvent, render } from "@testing-library/react-native";
import { StickerTabBar } from "./StickerTabBar";

const STATE = {
  index: 0,
  routes: [
    { key: "index", name: "index" },
    { key: "friends", name: "friends" },
    { key: "leaderboard", name: "leaderboard" },
    { key: "archive", name: "archive" },
  ],
} as any;

const NAV = { emit: jest.fn(() => ({})), navigate: jest.fn() };
const DESCRIPTORS: any = {
  index: { options: { title: "Today" } },
  friends: { options: { title: "Friends" } },
  leaderboard: { options: { title: "Board" } },
  archive: { options: { title: "Archive" } },
};

describe("StickerTabBar", () => {
  beforeEach(() => { NAV.navigate.mockClear(); });
  it("renders 4 tabs with their labels", () => {
    const { getByText } = render(
      <StickerTabBar state={STATE} navigation={NAV as any} descriptors={DESCRIPTORS} insets={{ bottom: 30 }} />
    );
    expect(getByText("TODAY")).toBeTruthy();
    expect(getByText("FRIENDS")).toBeTruthy();
    expect(getByText("BOARD")).toBeTruthy();
    expect(getByText("ARCHIVE")).toBeTruthy();
  });

  it("calls navigate on press of non-active tab", () => {
    const { getByText } = render(
      <StickerTabBar state={STATE} navigation={NAV as any} descriptors={DESCRIPTORS} insets={{ bottom: 30 }} />
    );
    fireEvent.press(getByText("FRIENDS"));
    expect(NAV.navigate).toHaveBeenCalledWith("friends");
  });
});
