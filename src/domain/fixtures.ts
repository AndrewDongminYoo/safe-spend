import type {
  DomainServices,
  ExpenseOccurrence,
  SafeSpendStateV2,
} from "./model";

export const testDomainServices: DomainServices = {
  createId: () => "id-1",
  now: () => "2026-09-22T00:00:00.000Z",
};

export function makeOccurrence(
  overrides: Partial<ExpenseOccurrence> = {},
): ExpenseOccurrence {
  return {
    id: "expense-occurrence",
    recurringExpenseId: "recurring-expense",
    name: "보험료",
    dueDate: "2026-09-25",
    estimatedAmount: 250_000,
    status: "pending",
    ...overrides,
  };
}

export function makeState(
  overrides: Partial<SafeSpendStateV2> = {},
): SafeSpendStateV2 {
  return {
    version: 2,
    balanceRevision: 0,
    currentBalance: 1_000_000,
    safetyReserve: 100_000,
    nextIncomeDate: "2026-10-01",
    recurringExpenses: [],
    occurrences: [],
    spendingRecords: [],
    updatedAt: "2026-09-22T00:00:00.000Z",
    ...overrides,
  };
}

export function makeStateWithPendingExpense(
  estimatedAmount: number,
): SafeSpendStateV2 {
  return makeState({
    recurringExpenses: [
      {
        id: "recurring-expense",
        name: "보험료",
        estimatedAmount,
        dueDay: 25,
        isActive: true,
      },
    ],
    occurrences: [makeOccurrence({ estimatedAmount })],
  });
}
