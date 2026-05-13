// ios/src/components/ClusterBubble.test.tsx
import { render } from "@testing-library/react-native";

// Mock api + deviceId so the test doesn't pull firebase/auth's ESM into Jest.
jest.mock("@/src/lib/api", () => ({ reportContent: jest.fn() }));
jest.mock("@/src/lib/deviceId", () => ({ getDeviceToken: jest.fn(async () => "dev") }));

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
    // Compare via JSON.stringify because Pressable injects per-render function
    // handlers that aren't referentially equal but serialise to the same shape.
    expect(JSON.stringify(a.toJSON())).toEqual(JSON.stringify(b.toJSON()));
  });
});
