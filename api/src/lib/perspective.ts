const TOXICITY_THRESHOLD = 0.85;
const SEVERE_TOXICITY_THRESHOLD = 0.50;
const ENDPOINT =
  "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze";

export interface ToxicityResult {
  verdict: "pass" | "block";
  score: number;
  skipped: boolean;
}

let cachedKey: string | undefined;

export function __resetPerspectiveForTest(): void {
  cachedKey = undefined;
}

function getKey(): string {
  if (!cachedKey) cachedKey = process.env.PERSPECTIVE_API_KEY;
  return cachedKey ?? "";
}

export async function evaluateToxicity(text: string): Promise<ToxicityResult> {
  const key = getKey();
  if (!key) return { verdict: "pass", score: 0, skipped: true };

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        comment: { text },
        languages: ["en"],
        requestedAttributes: { TOXICITY: {}, SEVERE_TOXICITY: {} },
      }),
    });
  } catch {
    return { verdict: "pass", score: 0, skipped: true };
  }

  if (!res.ok) return { verdict: "pass", score: 0, skipped: true };

  const json = (await res.json()) as {
    attributeScores?: {
      TOXICITY?: { summaryScore: { value: number } };
      SEVERE_TOXICITY?: { summaryScore: { value: number } };
    };
  };
  const tox = json.attributeScores?.TOXICITY?.summaryScore?.value ?? 0;
  const sev = json.attributeScores?.SEVERE_TOXICITY?.summaryScore?.value ?? 0;

  const block = tox >= TOXICITY_THRESHOLD || sev >= SEVERE_TOXICITY_THRESHOLD;
  return {
    verdict: block ? "block" : "pass",
    score: Math.max(tox, sev),
    skipped: false,
  };
}
