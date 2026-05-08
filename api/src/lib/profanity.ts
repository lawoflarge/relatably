const HATE_SLUR_PATTERNS: RegExp[] = [
  /\bn[i1]gg[ae]r\b/i,
  /\bf[a4]gg[o0]t\b/i,
  /\bret[a4]rd\b/i,
];

const VIOLENCE_PATTERNS: RegExp[] = [
  /\bkys\b/i,
  /\bkill\s+yourself\b/i,
  /\bkill\s+myself\b/i,
];

const ALL_PATTERNS: RegExp[] = [...HATE_SLUR_PATTERNS, ...VIOLENCE_PATTERNS];

export function containsProfanity(text: string): boolean {
  if (!text || !text.trim()) return false;
  return ALL_PATTERNS.some((p) => p.test(text));
}
