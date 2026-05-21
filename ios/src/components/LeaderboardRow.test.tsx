import { render } from "@testing-library/react-native";

// Short-circuit the firebase/auth ESM chain pulled in via @/src/lib/api.
jest.mock("@/src/lib/api", () => ({
  blockUser: jest.fn(),
  reportContent: jest.fn(),
}));
jest.mock("@/src/lib/deviceId", () => ({ getDeviceToken: jest.fn(async () => "dev") }));

import { LeaderboardRow } from "./LeaderboardRow";

describe("LeaderboardRow", () => {
  it("zero-pads the rank to two digits", () => {
    const { getByText } = render(
      <LeaderboardRow rank={1} handle="ace.exe" score={1284} streakDays={12} isSelf={false} crown />
    );
    expect(getByText("01")).toBeTruthy();
  });

  it("renders 'anon' when handle is null", () => {
    const { getByText } = render(
      <LeaderboardRow rank={2} handle={null} score={500} streakDays={0} isSelf={false} crown={false} />
    );
    expect(getByText("anon")).toBeTruthy();
  });

  it("renders crown sticker for #1", () => {
    const { getByText } = render(
      <LeaderboardRow rank={1} handle="ace.exe" score={1284} streakDays={12} isSelf={false} crown />
    );
    expect(getByText("★ #1")).toBeTruthy();
  });

  it("renders YOU tab when isSelf", () => {
    const { getByText } = render(
      <LeaderboardRow rank={4} handle="levin" score={982} streakDays={4} isSelf crown={false} />
    );
    expect(getByText("YOU")).toBeTruthy();
  });
});
