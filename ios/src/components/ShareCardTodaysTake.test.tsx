import { render } from "@testing-library/react-native";
import { ShareCardTodaysTake } from "./ShareCardTodaysTake";

describe("ShareCardTodaysTake", () => {
  it("renders the question + the user's answer + brand wordmark", () => {
    const { getByText } = render(
      <ShareCardTodaysTake
        questionText="What's the most overrated tourist trap?"
        userAnswer="EIFFEL TOWER"
        date="May 8, 2026"
      />,
    );
    expect(getByText("RELATABLY")).toBeTruthy();
    expect(getByText("May 8, 2026")).toBeTruthy();
    expect(getByText(/most overrated tourist trap/)).toBeTruthy();
    expect(getByText("EIFFEL TOWER")).toBeTruthy();
  });

  it("uppercases the user answer", () => {
    const { getByText } = render(
      <ShareCardTodaysTake
        questionText="q?"
        userAnswer="eiffel tower"
        date="May 8, 2026"
      />,
    );
    expect(getByText("EIFFEL TOWER")).toBeTruthy();
  });

  it("uses 1080x1920 dimensions", () => {
    const { getByTestId } = render(
      <ShareCardTodaysTake questionText="q?" userAnswer="x" date="d" />,
    );
    const root = getByTestId("share-card-todays-take");
    const flat = Array.isArray(root.props.style)
      ? Object.assign({}, ...root.props.style)
      : root.props.style;
    expect(flat.width).toBe(1080);
    expect(flat.height).toBe(1920);
  });
});
