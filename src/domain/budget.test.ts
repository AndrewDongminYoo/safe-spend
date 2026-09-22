import { describe, expect, it } from "vitest";

import { makeOccurrence, makeState } from "./fixtures";
import { calculateBudget, previewPurchase } from "./budget";

describe("calculateBudget", () => {
  it("protects pending expenses and reserve exactly once", () => {
    const state = makeState({
      currentBalance: 1_000_000,
      safetyReserve: 100_000,
      nextIncomeDate: "2026-10-01",
      occurrences: [
        makeOccurrence({
          estimatedAmount: 250_000,
          dueDate: "2026-09-25",
          status: "pending",
        }),
        makeOccurrence({
          id: "later-occurrence",
          estimatedAmount: 50_000,
          dueDate: "2026-10-02",
          status: "pending",
        }),
      ],
    });

    expect(calculateBudget(state, "2026-09-22")).toEqual({
      reservedAmount: 250_000,
      rawSafeToSpend: 650_000,
      safeToSpend: 650_000,
      shortfall: 0,
      remainingDays: 9,
      dailyAllowance: 72_222,
    });
  });

  it("includes overdue pending expenses but excludes completed ones", () => {
    const state = makeState({
      occurrences: [
        makeOccurrence({ dueDate: "2026-09-01", estimatedAmount: 30_000 }),
        makeOccurrence({ id: "paid", status: "paid", actualAmount: 20_000 }),
        makeOccurrence({ id: "skipped", status: "skipped" }),
      ],
    });

    expect(calculateBudget(state, "2026-09-22").reservedAmount).toBe(30_000);
  });

  it("clamps unsafe money to zero and reports the shortfall", () => {
    expect(
      calculateBudget(
        makeState({ currentBalance: 50_000, safetyReserve: 100_000 }),
        "2026-09-22",
      ),
    ).toMatchObject({
      rawSafeToSpend: -50_000,
      safeToSpend: 0,
      shortfall: 50_000,
    });
  });

  it("rejects protected amounts whose sum exceeds the safe integer range", () => {
    const state = makeState({
      currentBalance: 0,
      safetyReserve: Number.MAX_SAFE_INTEGER,
      occurrences: [
        makeOccurrence({ estimatedAmount: Number.MAX_SAFE_INTEGER }),
      ],
    });

    expect(() => calculateBudget(state, "2026-09-22")).toThrow(
      "Protected amount exceeds the supported won range",
    );
  });
});

describe("previewPurchase", () => {
  it("previews an amount above the current balance", () => {
    expect(
      previewPurchase(
        makeState({ currentBalance: 10_000, safetyReserve: 0 }),
        "2026-09-22",
        10_001,
      ),
    ).toMatchObject({ safeToSpendAfter: 0, shortfallAfter: 1 });
  });

  it("never emits Infinity when no money is safe", () => {
    const result = previewPurchase(
      makeState({ currentBalance: 10_000, safetyReserve: 10_000 }),
      "2026-09-22",
      10_000,
    );

    expect(result.impactPercent).toBeNull();
    expect(result.shortfallAfter).toBe(10_000);
  });

  it("retains the unrounded percentage and recalculates daily money", () => {
    const result = previewPurchase(
      makeState({ currentBalance: 1_000_000, safetyReserve: 0 }),
      "2026-09-22",
      100_000,
    );

    expect(result.impactPercent).toBe(10);
    expect(result.safeToSpendAfter).toBe(900_000);
    expect(result.dailyAllowanceAfter).toBe(100_000);
  });
});
