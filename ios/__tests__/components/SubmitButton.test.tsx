import { render, fireEvent, waitFor, act } from "@testing-library/react-native";
import { SubmitButton } from "../../src/components/SubmitButton";

describe("SubmitButton", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("is disabled before 3 seconds elapse", () => {
    const { getByRole } = render(
      <SubmitButton hasText={true} onPress={() => {}} startedAt={Date.now()} />,
    );
    const btn = getByRole("button");
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it("is disabled when text is empty even after 3 seconds", () => {
    const startedAt = Date.now();
    const { getByRole } = render(
      <SubmitButton hasText={false} onPress={() => {}} startedAt={startedAt} />,
    );

    act(() => {
      jest.advanceTimersByTime(3500);
    });

    const btn = getByRole("button");
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it("becomes enabled after 3 seconds AND text is non-empty", async () => {
    const startedAt = Date.now();
    const { getByRole } = render(
      <SubmitButton hasText={true} onPress={() => {}} startedAt={startedAt} />,
    );

    act(() => {
      jest.advanceTimersByTime(3500);
    });

    await waitFor(() => {
      const btn = getByRole("button");
      expect(btn.props.accessibilityState?.disabled).toBe(false);
    });
  });

  it("calls onPress when tapped while enabled", async () => {
    const onPress = jest.fn();
    const startedAt = Date.now();
    const { getByRole } = render(
      <SubmitButton hasText={true} onPress={onPress} startedAt={startedAt} />,
    );

    act(() => {
      jest.advanceTimersByTime(3500);
    });

    fireEvent.press(getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
