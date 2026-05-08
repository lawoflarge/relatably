import { describe, it, expect } from "vitest";
import { containsProfanity } from "./profanity";

describe("containsProfanity", () => {
  it("blocks the n-word and variants", () => {
    expect(containsProfanity("nigger")).toBe(true);
    expect(containsProfanity("n1gger")).toBe(true);
    expect(containsProfanity("NIGGER")).toBe(true);
  });

  it("blocks slurs we don't want in a wordcloud", () => {
    expect(containsProfanity("faggot")).toBe(true);
    expect(containsProfanity("retard")).toBe(true);
  });

  it("blocks blatant violent content", () => {
    expect(containsProfanity("kill yourself")).toBe(true);
    expect(containsProfanity("kys")).toBe(true);
  });

  it("does NOT block normal text containing substrings", () => {
    expect(containsProfanity("classics")).toBe(false);
    expect(containsProfanity("scunthorpe")).toBe(false);
    expect(containsProfanity("pisa tower")).toBe(false);
  });

  it("does NOT block mild language we consider acceptable Gen Z register", () => {
    expect(containsProfanity("damn")).toBe(false);
    expect(containsProfanity("hell")).toBe(false);
    expect(containsProfanity("crap")).toBe(false);
  });

  it("handles empty + whitespace", () => {
    expect(containsProfanity("")).toBe(false);
    expect(containsProfanity("   ")).toBe(false);
  });
});
