import { describe, expect, it } from "vitest";

import { calculateBudget } from "./budget";
import {
  makeState,
  makeStateWithPendingExpense,
  testDomainServices,
} from "./fixtures";
import type { DomainServices } from "./model";
import {
  addRecurringExpense,
  createInitialState,
  deactivateRecurringExpense,
  deleteSpendingRecord,
  editPendingOccurrence,
  markOccurrencePaid,
  markOccurrenceSkipped,
  recordPurchase,
  renewCycle,
  revertOccurrence,
  updateCycleSettings,
  updateRecurringExpense,
} from "./transitions";

function makeServices(...ids: string[]): DomainServices {
  let index = 0;

  return {
    createId: () => ids[index++] ?? `id-${index}`,
    now: () => "2026-09-22T12:00:00.000Z",
  };
}

describe("purchase records", () => {
  it("records a trimmed memo and subtracts the amount", () => {
    const result = recordPurchase(
      makeState(),
      20_000,
      "  점심  ",
      testDomainServices,
    );

    expect(result.currentBalance).toBe(980_000);
    expect(result.spendingRecords).toEqual([
      {
        id: "id-1",
        amount: 20_000,
        memo: "점심",
        spentAt: "2026-09-22T00:00:00.000Z",
      },
    ]);
  });

  it("converts an empty memo to undefined", () => {
    expect(
      recordPurchase(makeState(), 1_000, "   ", testDomainServices)
        .spendingRecords[0],
    ).not.toHaveProperty("memo");
  });

  it("restores balance when a spending record is deleted", () => {
    const recorded = recordPurchase(
      makeState({ currentBalance: 500_000 }),
      20_000,
      "점심",
      testDomainServices,
    );

    expect(deleteSpendingRecord(recorded, "id-1").currentBalance).toBe(500_000);
  });

  it("rejects unsafe or unaffordable purchases", () => {
    expect(() =>
      recordPurchase(makeState(), -1, undefined, testDomainServices),
    ).toThrow("safe non-negative integer");
    expect(() =>
      recordPurchase(
        makeState({ currentBalance: 1_000 }),
        1_001,
        undefined,
        testDomainServices,
      ),
    ).toThrow("current balance");
  });
});

describe("expense occurrence transitions", () => {
  it("keeps safe money unchanged when actual expense matches the estimate", () => {
    const before = makeStateWithPendingExpense(250_000);
    const after = markOccurrencePaid(before, "expense-occurrence", 250_000);

    expect(after.currentBalance).toBe(before.currentBalance - 250_000);
    expect(calculateBudget(after, "2026-09-22").safeToSpend).toBe(
      calculateBudget(before, "2026-09-22").safeToSpend,
    );
  });

  it.each([
    [200_000, 50_000],
    [300_000, -50_000],
  ] as const)(
    "adjusts safe money when actual is %s",
    (actualAmount, expectedDifference) => {
      const before = makeStateWithPendingExpense(250_000);
      const after = markOccurrencePaid(
        before,
        "expense-occurrence",
        actualAmount,
      );

      expect(
        calculateBudget(after, "2026-09-22").safeToSpend -
          calculateBudget(before, "2026-09-22").safeToSpend,
      ).toBe(expectedDifference);
    },
  );

  it("rejects paying the same occurrence twice", () => {
    const paid = markOccurrencePaid(
      makeStateWithPendingExpense(250_000),
      "expense-occurrence",
      250_000,
    );

    expect(() =>
      markOccurrencePaid(paid, "expense-occurrence", 250_000),
    ).toThrow("pending occurrence");
  });

  it("rejects a payment above the current balance", () => {
    expect(() =>
      markOccurrencePaid(
        makeStateWithPendingExpense(250_000),
        "expense-occurrence",
        1_000_001,
      ),
    ).toThrow("current balance");
  });

  it("skips and reverts an occurrence without changing balance", () => {
    const before = makeStateWithPendingExpense(250_000);
    const skipped = markOccurrenceSkipped(before, "expense-occurrence");
    const reverted = revertOccurrence(skipped, "expense-occurrence");

    expect(skipped.currentBalance).toBe(before.currentBalance);
    expect(skipped.occurrences[0]?.status).toBe("skipped");
    expect(reverted).toEqual(before);
  });

  it("restores a paid amount when reverted", () => {
    const before = makeStateWithPendingExpense(250_000);
    const paid = markOccurrencePaid(before, "expense-occurrence", 200_000);
    const reverted = revertOccurrence(paid, "expense-occurrence");

    expect(reverted).toEqual(before);
  });

  it("edits only a pending occurrence", () => {
    const edited = editPendingOccurrence(
      makeStateWithPendingExpense(250_000),
      "expense-occurrence",
      {
        name: "  새 보험료 ",
        dueDate: "2026-09-27",
        estimatedAmount: 260_000,
      },
    );

    expect(edited.occurrences[0]).toMatchObject({
      name: "새 보험료",
      dueDate: "2026-09-27",
      estimatedAmount: 260_000,
    });
    expect(() =>
      editPendingOccurrence(
        markOccurrenceSkipped(edited, "expense-occurrence"),
        "expense-occurrence",
        { name: "보험료", dueDate: "2026-09-27", estimatedAmount: 260_000 },
      ),
    ).toThrow("pending occurrence");
  });
});

describe("recurring expenses", () => {
  it("creates definitions and current-cycle occurrences during onboarding", () => {
    const state = createInitialState(
      {
        currentBalance: 1_000_000,
        safetyReserve: 100_000,
        cycleStartDate: "2026-09-22",
        nextIncomeDate: "2026-10-01",
        recurringExpenses: [
          { name: " 보험료 ", estimatedAmount: 250_000, dueDay: 25 },
        ],
      },
      makeServices("recurring-1", "occurrence-1"),
    );

    expect(state.recurringExpenses[0]).toMatchObject({
      id: "recurring-1",
      name: "보험료",
    });
    expect(state.occurrences[0]).toMatchObject({
      id: "occurrence-1",
      recurringExpenseId: "recurring-1",
      dueDate: "2026-09-25",
    });
  });

  it("adds an occurrence only when the next due date is in the horizon", () => {
    const added = addRecurringExpense(
      makeState(),
      {
        name: "통신비",
        estimatedAmount: 80_000,
        dueDay: 25,
        today: "2026-09-22",
      },
      makeServices("recurring-2", "occurrence-2"),
    );
    const outside = addRecurringExpense(
      makeState(),
      {
        name: "월세",
        estimatedAmount: 500_000,
        dueDay: 2,
        today: "2026-09-22",
      },
      makeServices("recurring-3"),
    );

    expect(added.occurrences).toHaveLength(1);
    expect(outside.occurrences).toHaveLength(0);
  });

  it("updates a definition without rewriting its current occurrence", () => {
    const before = makeStateWithPendingExpense(250_000);
    const after = updateRecurringExpense(before, "recurring-expense", {
      name: "새 보험료",
      estimatedAmount: 260_000,
      dueDay: 27,
    });

    expect(after.recurringExpenses[0]).toMatchObject({
      name: "새 보험료",
      estimatedAmount: 260_000,
      dueDay: 27,
    });
    expect(after.occurrences).toEqual(before.occurrences);
  });

  it("deactivates a definition while preserving occurrence history", () => {
    const before = makeStateWithPendingExpense(250_000);
    const after = deactivateRecurringExpense(before, "recurring-expense");

    expect(after.recurringExpenses[0]?.isActive).toBe(false);
    expect(after.occurrences).toEqual(before.occurrences);
  });
});

describe("cycle settings and renewal", () => {
  it("updates validated cycle settings", () => {
    const state = updateCycleSettings(makeState(), {
      currentBalance: 800_000,
      safetyReserve: 50_000,
      nextIncomeDate: "2026-10-25",
    });

    expect(state).toMatchObject({
      currentBalance: 800_000,
      safetyReserve: 50_000,
      nextIncomeDate: "2026-10-25",
    });
  });

  it("retains history and creates active occurrences strictly after income", () => {
    const before = makeStateWithPendingExpense(250_000);
    const renewed = renewCycle(
      before,
      {
        currentBalance: 1_200_000,
        receivedOn: "2026-10-01",
        nextIncomeDate: "2026-11-01",
      },
      makeServices("new-occurrence"),
    );

    expect(renewed.occurrences[0]).toEqual(before.occurrences[0]);
    expect(renewed.occurrences[1]).toMatchObject({
      id: "new-occurrence",
      dueDate: "2026-10-25",
      status: "pending",
    });
  });
});
