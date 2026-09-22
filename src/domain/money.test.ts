import { describe, expect, it } from "vitest";

import { assertWon, formatWon, parseWonInput } from "./money";

describe("assertWon", () => {
  it.each([0, 1, 1_000_000, Number.MAX_SAFE_INTEGER])("accepts %s", (value) => {
    expect(assertWon(value)).toBe(value);
  });

  it.each([
    -1,
    1.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
  ])("rejects %s", (value) => {
    expect(() => assertWon(value)).toThrow("safe non-negative integer");
  });
});

describe("parseWonInput", () => {
  it("parses formatted won input without rounding", () => {
    expect(parseWonInput("1,234,500")).toBe(1_234_500);
  });

  it.each(["12.5", "-1", "", "1 000"])("rejects invalid input %s", (value) => {
    expect(() => parseWonInput(value)).toThrow("whole won amount");
  });
});

it("formats won using Korean digit grouping", () => {
  expect(formatWon(1_234_500)).toBe("1,234,500");
});
