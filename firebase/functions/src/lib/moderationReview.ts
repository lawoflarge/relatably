import { evaluateToxicity, type ToxicityResult } from "./perspective";

export interface ReviewInput {
  raw_text: string;
}

export async function reviewSubmission(input: ReviewInput): Promise<ToxicityResult> {
  return evaluateToxicity(input.raw_text);
}
