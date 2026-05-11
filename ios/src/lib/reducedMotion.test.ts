import { renderHook, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { useReducedMotion } from "./reducedMotion";

describe("useReducedMotion", () => {
  it("starts false, reflects async value", async () => {
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValueOnce(true);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockReturnValue({ remove: jest.fn() } as any);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
    await waitFor(() => expect(result.current).toBe(true));
  });
});
