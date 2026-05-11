import { render, fireEvent } from "@testing-library/react-native";
import { AnswerInput } from "./AnswerInput";

describe("AnswerInput", () => {
  it("calls onChangeText when text typed", () => {
    const handle = jest.fn();
    const { getByPlaceholderText } = render(<AnswerInput value="" onChangeText={handle} />);
    fireEvent.changeText(getByPlaceholderText("your take?"), "hi");
    expect(handle).toHaveBeenCalledWith("hi");
  });
  it("respects editable=false", () => {
    const { getByPlaceholderText } = render(<AnswerInput value="" onChangeText={() => {}} editable={false} />);
    expect(getByPlaceholderText("your take?").props.editable).toBe(false);
  });
});
