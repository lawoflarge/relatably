// ios/src/components/ClusterBubble.test.tsx
import { render } from "@testing-library/react-native";
import { ClusterBubble } from "./ClusterBubble";

describe("ClusterBubble", () => {
  it("renders the cluster text", () => {
    const { getByText } = render(
      <ClusterBubble id="c_ai" text="AI" count={3204} maxCount={3204} isSelf={false} colorIndex={0} />
    );
    expect(getByText("AI")).toBeTruthy();
  });

  it("renders a YOU tab when isSelf is true", () => {
    const { getByText } = render(
      <ClusterBubble id="c_ai" text="AI" count={3204} maxCount={3204} isSelf colorIndex={0} />
    );
    expect(getByText("YOU")).toBeTruthy();
  });

  it("uses the same rotation for the same id on re-render", () => {
    const a = render(
      <ClusterBubble id="c_ai" text="AI" count={3204} maxCount={3204} isSelf={false} colorIndex={0} />
    );
    const b = render(
      <ClusterBubble id="c_ai" text="AI" count={3204} maxCount={3204} isSelf={false} colorIndex={0} />
    );
    expect(a.toJSON()).toEqual(b.toJSON());
  });
});
