import { fireEvent, render } from "@testing-library/react-native";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import { ArchiveScreen } from "./ArchiveScreen";
import type { ArchiveTile } from "@/src/types/api";

function tile(i: number, top = ["a", "b", "c"]): ArchiveTile {
  return {
    question_id: `q-${i}`,
    question_text: `question ${i}?`,
    verdict_text: top[0] ?? "",
    top_clusters: top,
    created_at: new Date(2026, 4, 9 - i).toISOString(),
  };
}

describe("ArchiveScreen", () => {
  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_ADMOB_ENABLED;
    const { __resetAdsForTest } = require("@/src/lib/ads");
    __resetAdsForTest();
  });

  it("shows empty-state copy when no tiles", () => {
    const { getByText } = render(
      <ArchiveScreen tiles={[]} nextCursor={null} onLoadMore={() => {}} onTilePress={() => {}} onTileLongPress={() => {}} />,
    );
    expect(getByText(/fresh archive/i)).toBeTruthy();
  });

  it("renders one tile per archive entry", () => {
    const tiles = [tile(0), tile(1), tile(2)];
    const { getByText } = render(
      <ArchiveScreen tiles={tiles} nextCursor={null} onLoadMore={() => {}} onTilePress={() => {}} onTileLongPress={() => {}} />,
    );
    expect(getByText("question 0?")).toBeTruthy();
    expect(getByText("question 1?")).toBeTruthy();
    expect(getByText("question 2?")).toBeTruthy();
  });

  it("injects an ad slot after every 8 tiles", () => {
    const tiles = Array.from({ length: 17 }, (_, i) => tile(i));
    const { queryAllByTestId } = render(
      <ArchiveScreen tiles={tiles} nextCursor={null} onLoadMore={() => {}} onTilePress={() => {}} onTileLongPress={() => {}} />,
    );
    expect(queryAllByTestId("banner-ad-slot-disabled")).toHaveLength(2);
  });

  it("calls onTilePress with question_id when a tile is tapped", () => {
    const onTilePress = jest.fn();
    const tiles = [tile(0), tile(1)];
    const { getByText } = render(
      <ArchiveScreen tiles={tiles} nextCursor={null} onLoadMore={() => {}} onTilePress={onTilePress} onTileLongPress={() => {}} />,
    );
    fireEvent.press(getByText("question 1?"));
    expect(onTilePress).toHaveBeenCalledWith("q-1");
  });

  it("calls onTileLongPress with the tile when long-pressed", () => {
    const onTileLongPress = jest.fn();
    const tiles = [tile(0)];
    const { getByText } = render(
      <ArchiveScreen tiles={tiles} nextCursor={null} onLoadMore={() => {}} onTilePress={() => {}} onTileLongPress={onTileLongPress} />,
    );
    fireEvent(getByText("question 0?"), "longPress");
    expect(onTileLongPress).toHaveBeenCalledWith(tiles[0]);
  });
});
