import { render } from "@testing-library/react-native";
import { ShareCardCalledIt } from "./ShareCardCalledIt";

describe("ShareCardCalledIt", () => {
  const props = {
    verdictText: "pisa tower",
    clusterCount: 412381,
    handle: "ick_of_the_day",
    date: "May 8, 2026",
  };

  it("renders the 👑 emoji + uppercased verdict + handle", () => {
    const { getByText } = render(<ShareCardCalledIt {...props} />);
    expect(getByText(/I CALLED IT/)).toBeTruthy();
    expect(getByText("PISA TOWER")).toBeTruthy();
    expect(getByText("@ick_of_the_day")).toBeTruthy();
  });

  it("formats cluster_count with thousands separators", () => {
    const { getByText } = render(<ShareCardCalledIt {...props} />);
    expect(getByText(/412,381/)).toBeTruthy();
  });

  it("falls back when handle is null", () => {
    const { getByText } = render(<ShareCardCalledIt {...props} handle={null} />);
    expect(getByText("@anonymous")).toBeTruthy();
  });
});
