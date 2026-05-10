import { render } from "@testing-library/react-native";
import { Text } from "react-native";
import { StickerSurface } from "./StickerSurface";

describe("StickerSurface", () => {
  it("renders children", () => {
    const { getByText } = render(
      <StickerSurface><Text>hello</Text></StickerSurface>
    );
    expect(getByText("hello")).toBeTruthy();
  });

  it("applies default shadow=m and border=3", () => {
    const { getByTestId } = render(
      <StickerSurface testID="surf"><Text>x</Text></StickerSurface>
    );
    const styles = getByTestId("surf").props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles.filter(Boolean)) : styles;
    expect(flat.borderWidth).toBe(3);
    expect(flat.shadowOffset).toEqual({ width: 4, height: 4 });
    expect(flat.shadowRadius).toBe(0);
  });

  it("rotates via transform when rotate prop provided", () => {
    const { getByTestId } = render(
      <StickerSurface testID="surf" rotate={-2}><Text>x</Text></StickerSurface>
    );
    const styles = getByTestId("surf").props.style;
    const flat = Array.isArray(styles) ? Object.assign({}, ...styles.filter(Boolean)) : styles;
    expect(flat.transform).toEqual([{ rotate: "-2deg" }]);
  });
});
