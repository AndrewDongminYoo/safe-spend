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
  postponePendingOccurrence,
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
        balanceRevision: 0,
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

  it("does not refund a spending record after the balance is replaced", () => {
    const recorded = recordPurchase(
      makeState({ currentBalance: 500_000 }),
      100_000,
      "과거 지출",
      testDomainServices,
    );
    const replaced = updateCycleSettings(
      recorded,
      {
        currentBalance: 3_000_000,
        safetyReserve: recorded.safetyReserve,
        nextIncomeDate: recorded.nextIncomeDate,
      },
      makeServices(),
    );

    expect(deleteSpendingRecord(replaced, "id-1").currentBalance).toBe(
      3_000_000,
    );
  });

  it("keeps a current deduction refundable when only other settings change", () => {
    const recorded = recordPurchase(
      makeState({ currentBalance: 500_000 }),
      100_000,
      "현재 지출",
      testDomainServices,
    );
    const settingsChanged = updateCycleSettings(
      recorded,
      {
        currentBalance: recorded.currentBalance,
        safetyReserve: 50_000,
        nextIncomeDate: recorded.nextIncomeDate,
      },
      makeServices(),
    );

    expect(deleteSpendingRecord(settingsChanged, "id-1").currentBalance).toBe(
      500_000,
    );
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

  it("does not refund an occurrence paid before cycle renewal", () => {
    const paid = markOccurrencePaid(
      makeStateWithPendingExpense(250_000),
      "expense-occurrence",
      200_000,
    );
    const renewed = renewCycle(
      paid,
      {
        currentBalance: 3_000_000,
        receivedOn: "2026-10-01",
        nextIncomeDate: "2026-11-01",
      },
      makeServices("new-occurrence"),
    );

    expect(revertOccurrence(renewed, "expense-occurrence").currentBalance).toBe(
      3_000_000,
    );
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

  it("postpones a pending occurrence without changing its other fields", () => {
    const before = makeStateWithPendingExpense(250_000);
    const postponed = postponePendingOccurrence(
      before,
      "expense-occurrence",
      "2026-10-02",
    );

    expect(postponed.currentBalance).toBe(before.currentBalance);
    expect(postponed.occurrences[0]).toEqual({
      ...before.occurrences[0],
      dueDate: "2026-10-02",
    });
    expect(calculateBudget(postponed, "2026-09-22").reservedAmount).toBe(0);
  });

  it.each(["2026-09-25", "2026-09-24"])(
    "rejects postponing to a non-later date: %s",
    (dueDate) => {
      expect(() =>
        postponePendingOccurrence(
          makeStateWithPendingExpense(250_000),
          "expense-occurrence",
          dueDate,
        ),
      ).toThrow("after the current due date");
    },
  );

  it("rejects postponing a completed occurrence", () => {
    const skipped = markOccurrenceSkipped(
      makeStateWithPendingExpense(250_000),
      "expense-occurrence",
    );

    expect(() =>
      postponePendingOccurrence(skipped, "expense-occurrence", "2026-10-02"),
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

  it("updates the current pending occurrence with its recurring definition", () => {
    const before = makeStateWithPendingExpense(250_000);
    const after = updateRecurringExpense(
      before,
      "recurring-expense",
      {
        name: "새 보험료",
        estimatedAmount: 260_000,
        dueDay: 27,
        today: "2026-09-22",
      },
      makeServices("unused"),
    );

    expect(after.recurringExpenses[0]).toMatchObject({
      name: "새 보험료",
      estimatedAmount: 260_000,
      dueDay: 27,
    });
    expect(after.occurrences).toEqual([
      {
        ...before.occurrences[0],
        name: "새 보험료",
        estimatedAmount: 260_000,
        dueDate: "2026-09-27",
      },
    ]);
    expect(calculateBudget(after, "2026-09-22").reservedAmount).toBe(260_000);
  });

  it("replaces an overdue pending occurrence instead of reserving twice", () => {
    const before = makeStateWithPendingExpense(200_000);
    before.occurrences = [{ ...before.occurrences[0]!, dueDate: "2026-09-20" }];

    const after = updateRecurringExpense(
      before,
      "recurring-expense",
      {
        name: "새 보험료",
        estimatedAmount: 220_000,
        dueDay: 24,
        today: "2026-09-23",
      },
      makeServices("unused"),
    );

    expect(after.occurrences).toEqual([
      expect.objectContaining({
        id: "expense-occurrence",
        name: "새 보험료",
        dueDate: "2026-09-24",
        estimatedAmount: 220_000,
        status: "pending",
      }),
    ]);
    expect(calculateBudget(after, "2026-09-23").reservedAmount).toBe(220_000);
  });

  it("preserves completed history while reconciling a definition", () => {
    const before = markOccurrencePaid(
      makeStateWithPendingExpense(200_000),
      "expense-occurrence",
      190_000,
    );

    const after = updateRecurringExpense(
      before,
      "recurring-expense",
      {
        name: "새 보험료",
        estimatedAmount: 220_000,
        dueDay: 27,
        today: "2026-09-22",
      },
      makeServices("new-occurrence"),
    );

    expect(after.occurrences).toHaveLength(2);
    expect(after.occurrences[0]).toEqual(before.occurrences[0]);
    expect(after.occurrences[1]).toMatchObject({
      id: "new-occurrence",
      name: "새 보험료",
      dueDate: "2026-09-27",
      estimatedAmount: 220_000,
      status: "pending",
    });
  });

  it("protects an edited expense that moves into the current cycle", () => {
    const before = makeState({
      currentBalance: 581_820,
      safetyReserve: 0,
      nextIncomeDate: "2026-09-29",
      recurringExpenses: [
        {
          id: "rent",
          name: "월세",
          estimatedAmount: 780_000,
          dueDay: 30,
          isActive: true,
        },
      ],
    });
    const after = updateRecurringExpense(
      before,
      "rent",
      {
        name: "월세",
        estimatedAmount: 780_000,
        dueDay: 26,
        today: "2026-09-22",
      },
      makeServices("occurrence-1"),
    );

    expect(after.occurrences).toEqual([
      expect.objectContaining({
        recurringExpenseId: "rent",
        dueDate: "2026-09-26",
        estimatedAmount: 780_000,
        status: "pending",
      }),
    ]);
    expect(calculateBudget(after, "2026-09-22")).toMatchObject({
      reservedAmount: 780_000,
      safeToSpend: 0,
      shortfall: 198_180,
    });
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
    const state = updateCycleSettings(
      makeState(),
      {
        currentBalance: 800_000,
        safetyReserve: 50_000,
        nextIncomeDate: "2026-10-25",
      },
      makeServices(),
    );

    expect(state).toMatchObject({
      currentBalance: 800_000,
      safetyReserve: 50_000,
      nextIncomeDate: "2026-10-25",
    });
  });

  it("generates expenses when the income-date horizon is extended", () => {
    const before = makeState({
      currentBalance: 1_000_000,
      safetyReserve: 0,
      nextIncomeDate: "2026-09-25",
      recurringExpenses: [
        {
          id: "rent",
          name: "월세",
          estimatedAmount: 500_000,
          dueDay: 5,
          isActive: true,
        },
      ],
    });
    const after = updateCycleSettings(
      before,
      {
        currentBalance: before.currentBalance,
        safetyReserve: before.safetyReserve,
        nextIncomeDate: "2026-10-10",
      },
      makeServices("october-rent"),
    );

    expect(after.occurrences).toEqual([
      expect.objectContaining({
        id: "october-rent",
        recurringExpenseId: "rent",
        dueDate: "2026-10-05",
        status: "pending",
      }),
    ]);
    expect(calculateBudget(after, "2026-09-23").reservedAmount).toBe(500_000);
  });

  it("generates the bill due on a late renewal confirmation day", () => {
    const before = makeState({
      currentBalance: 1_000_000,
      safetyReserve: 0,
      nextIncomeDate: "2026-09-25",
      recurringExpenses: [
        {
          id: "rent",
          name: "월세",
          estimatedAmount: 500_000,
          dueDay: 5,
          isActive: true,
        },
      ],
    });
    const after = renewCycle(
      before,
      {
        currentBalance: 1_000_000,
        receivedOn: "2026-10-05",
        nextIncomeDate: "2026-10-31",
      },
      makeServices("october-rent"),
    );

    expect(after.occurrences).toEqual([
      expect.objectContaining({
        id: "october-rent",
        recurringExpenseId: "rent",
        dueDate: "2026-10-05",
        status: "pending",
      }),
    ]);
    expect(calculateBudget(after, "2026-10-05").reservedAmount).toBe(500_000);
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
