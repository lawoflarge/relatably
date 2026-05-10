import { fireEvent, render } from "@testing-library/react-native";
import { StickerButton } from "./StickerButton";

describe("StickerButton", () => {
  it("renders the label", () => {
    const { getByText } = render(<StickerButton label="DROP IT" onPress={() => {}} />);
    expect(getByText("DROP IT")).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    const { getByRole } = render(<StickerButton label="GO" onPress={onPress} />);
    fireEvent.press(getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("uses pink fill for primary variant", () => {
    const { getByTestId } = render(<StickerButton testID="b" label="GO" onPress={() => {}} variant="primary" />);
    const flat = Array.isArray(getByTestId("b").props.style)
      ? Object.assign({}, ...getByTestId("b").props.style.filter(Boolean))
      : getByTestId("b").props.style;
    expect(flat.backgroundColor).toBe("#FF4FA3");
  });

  it("uses mint fill for secondary variant", () => {
    const { getByTestId } = render(<StickerButton testID="b" label="x" onPress={() => {}} variant="secondary" />);
    const flat = Array.isArray(getByTestId("b").props.style)
      ? Object.assign({}, ...getByTestId("b").props.style.filter(Boolean))
      : getByTestId("b").props.style;
    expect(flat.backgroundColor).toBe("#7AE6C3");
  });

  it("disables and removes onPress when disabled prop set", () => {
    const onPress = jest.fn();
    const { getByRole } = render(<StickerButton label="GO" onPress={onPress} disabled />);
    fireEvent.press(getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
