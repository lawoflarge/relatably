import { render, fireEvent } from "@testing-library/react-native";
import { ShareButton } from "./ShareButton";

jest.mock("@/src/lib/shareCard", () => ({
  shareCardImage: jest.fn(),
}));
import { shareCardImage } from "@/src/lib/shareCard";

describe("ShareButton", () => {
  beforeEach(() => jest.clearAllMocks());

  it("invokes shareCardImage on press with the given opts", async () => {
    (shareCardImage as jest.Mock).mockResolvedValue({ referral_code: "x" });
    const ref = { current: { __dummy: true } };
    const { getByRole } = render(
      <ShareButton
        viewRef={ref as any}
        banner_type="todays_take"
        question_id="q1"
        share_target="system"
        label="share"
      />,
    );
    fireEvent.press(getByRole("button"));
    // shareCardImage is async; let microtasks run.
    await Promise.resolve();
    expect(shareCardImage).toHaveBeenCalledWith({
      viewRef: ref,
      banner_type: "todays_take",
      question_id: "q1",
      share_target: "system",
    });
  });

  it("renders the given label", () => {
    const { getByText } = render(
      <ShareButton
        viewRef={{ current: null } as any}
        banner_type="todays_take"
        question_id="q1"
        share_target="system"
        label="🚀 share"
      />,
    );
    expect(getByText("🚀 share")).toBeTruthy();
  });
});
