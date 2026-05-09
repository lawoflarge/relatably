import { render } from "@testing-library/react-native";
import { ArchiveTileThumbnail } from "./ArchiveTileThumbnail";

describe("ArchiveTileThumbnail", () => {
  it("renders nothing when texts is empty", () => {
    const { queryAllByTestId } = render(<ArchiveTileThumbnail texts={[]} />);
    expect(queryAllByTestId("archive-thumb-bubble")).toHaveLength(0);
  });

  it("renders one bubble per text up to 5 max", () => {
    const { getAllByTestId } = render(
      <ArchiveTileThumbnail texts={["a", "b", "c", "d", "e", "f", "g"]} />,
    );
    expect(getAllByTestId("archive-thumb-bubble")).toHaveLength(5);
  });

  it("renders all texts when count <= 5", () => {
    const { getAllByText } = render(
      <ArchiveTileThumbnail texts={["yes", "no", "maybe"]} />,
    );
    expect(getAllByText("yes")).toHaveLength(1);
    expect(getAllByText("no")).toHaveLength(1);
    expect(getAllByText("maybe")).toHaveLength(1);
  });
});
