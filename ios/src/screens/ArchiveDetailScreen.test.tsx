import { render, waitFor } from "@testing-library/react-native";
import { ArchiveDetailScreen } from "./ArchiveDetailScreen";

jest.mock("@/src/lib/api", () => ({
  fetchArchiveDetail: jest.fn(),
}));

const { fetchArchiveDetail } = require("@/src/lib/api");

describe("ArchiveDetailScreen", () => {
  beforeEach(() => {
    fetchArchiveDetail.mockReset();
  });

  it("renders loading state initially", () => {
    fetchArchiveDetail.mockReturnValue(new Promise(() => {}));
    const { getByText } = render(<ArchiveDetailScreen questionId="q1" />);
    expect(getByText(/loading/i)).toBeTruthy();
  });

  it("renders question text + clusters after fetch", async () => {
    fetchArchiveDetail.mockResolvedValueOnce({
      id: "q1",
      text: "what's the most overrated tourist trap?",
      created_at: "2026-05-09T00:00:00.000Z",
      top_clusters: [
        { id: "c1", canonical_text: "Pisa Tower", submission_count: 412, final_rank: 1, final_pct_of_total: 0.31 },
        { id: "c2", canonical_text: "Eiffel Tower", submission_count: 80, final_rank: 2, final_pct_of_total: 0.06 },
      ],
    });

    const { getByText, getAllByText } = render(<ArchiveDetailScreen questionId="q1" />);
    await waitFor(() => {
      expect(getByText(/most overrated tourist trap/)).toBeTruthy();
      // Cluster text appears in the list row AND in the offscreen ShareCardVerdict satellites.
      expect(getAllByText("Pisa Tower").length).toBeGreaterThan(0);
      expect(getAllByText("Eiffel Tower").length).toBeGreaterThan(0);
    });
  });

  it("renders error state on fetch failure", async () => {
    fetchArchiveDetail.mockRejectedValueOnce(new Error("boom"));
    const { getByText } = render(<ArchiveDetailScreen questionId="q1" />);
    await waitFor(() => {
      expect(getByText(/couldn't load/i)).toBeTruthy();
    });
  });
});
