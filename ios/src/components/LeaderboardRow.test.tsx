import { render } from "@testing-library/react-native";
import { LeaderboardRow } from "./LeaderboardRow";

describe("LeaderboardRow", () => {
  it("renders rank, handle, and score", () => {
    const { getByText } = render(
      <LeaderboardRow rank={1} handle="@coolname" score={1500} locale="us" />,
    );
    expect(getByText("#1")).toBeTruthy();
    expect(getByText("@coolname")).toBeTruthy();
    expect(getByText("1500")).toBeTruthy();
  });

  it("falls back to anonymous label when handle is null", () => {
    const { getByText } = render(
      <LeaderboardRow rank={42} handle={null} score={100} locale="us" />,
    );
    expect(getByText(/anon/i)).toBeTruthy();
  });
});
