import { createHash } from "node:crypto";

const LEADING_ARTICLES = ["the ", "a ", "an "];
const TRAILING_PUNCT = /[.!?,…]+$/;
const MULTIPLE_SPACES = /\s+/g;

export function normalize(input: string): string {
  let s = input.trim().toLowerCase();
  for (const article of LEADING_ARTICLES) {
    if (s.startsWith(article)) {
      s = s.slice(article.length);
      break;
    }
  }
  s = s.replace(TRAILING_PUNCT, "");
  s = s.replace(MULTIPLE_SPACES, " ");
  return s.trim();
}

export function clusterId(questionId: string, normalizedText: string): string {
  return createHash("sha256")
    .update(`${questionId}|${normalizedText}`)
    .digest("hex");
}
