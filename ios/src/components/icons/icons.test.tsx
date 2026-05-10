import { render } from "@testing-library/react-native";
import * as icons from ".";

const NAMES = [
  "IconHome", "IconFriends", "IconBoard", "IconArchive",
  "IconShare", "IconFlame", "IconCrown", "IconSparkle", "IconPeelCorner",
] as const;

describe("icon set", () => {
  it.each(NAMES)("%s renders at default size 24", (name) => {
    const Cmp = (icons as any)[name];
    const tree = render(<Cmp testID="i" />);
    expect(tree.getByTestId("i")).toBeTruthy();
  });

  it.each(NAMES)("%s accepts size prop", (name) => {
    const Cmp = (icons as any)[name];
    const tree = render(<Cmp testID="i" size={48} />);
    expect(tree.getByTestId("i")).toBeTruthy();
  });

  it.each(NAMES)("%s accepts color prop", (name) => {
    const Cmp = (icons as any)[name];
    const tree = render(<Cmp testID="i" color="#FF0000" />);
    expect(tree.getByTestId("i")).toBeTruthy();
  });
});
