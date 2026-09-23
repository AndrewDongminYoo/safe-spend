import {
  compareLocalDates,
  listMonthlyDueDates,
  resolveMonthlyDueDate,
} from "./calendar";
import { assertProtectedAmountRange } from "./budget";
import { assertWon } from "./money";
import type {
  DomainServices,
  ExpenseOccurrence,
  InitialStateInput,
  RecurringExpense,
  RecurringExpenseInput,
  SafeSpendStateV2,
} from "./model";
import type { LocalDate, Won } from "./types";

function assertName(value: string): string {
  const name = value.trim();

  if (name.length === 0) {
    throw new Error("Expense name must not be empty");
  }

  return name;
}

function assertLocalDate(value: LocalDate): LocalDate {
  compareLocalDates(value, value);
  return value;
}

function assertDueDay(dueDay: number): number {
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new Error("Due day must be an integer between 1 and 31");
  }

  return dueDay;
}

function assertDeductibleBalance(state: SafeSpendStateV2, amount: Won): Won {
  const validatedAmount = assertWon(amount);

  if (validatedAmount > assertWon(state.currentBalance)) {
    throw new Error("Amount cannot exceed the current balance");
  }

  return validatedAmount;
}

function findOccurrence(
  state: SafeSpendStateV2,
  occurrenceId: string,
): ExpenseOccurrence {
  const occurrence = state.occurrences.find(({ id }) => id === occurrenceId);

  if (occurrence === undefined) {
    throw new Error(`Expense occurrence not found: ${occurrenceId}`);
  }

  return occurrence;
}

function findPendingOccurrence(
  state: SafeSpendStateV2,
  occurrenceId: string,
): ExpenseOccurrence {
  const occurrence = findOccurrence(state, occurrenceId);

  if (occurrence.status !== "pending") {
    throw new Error("Action requires a pending occurrence");
  }

  return occurrence;
}

function replaceOccurrence(
  state: SafeSpendStateV2,
  replacement: ExpenseOccurrence,
): ExpenseOccurrence[] {
  return state.occurrences.map((occurrence) =>
    occurrence.id === replacement.id ? replacement : occurrence,
  );
}

function makeRecurringExpense(
  input: RecurringExpenseInput,
  id: string,
): RecurringExpense {
  return {
    id,
    name: assertName(input.name),
    estimatedAmount: assertWon(input.estimatedAmount),
    dueDay: assertDueDay(input.dueDay),
    isActive: true,
  };
}

function makeOccurrence(
  recurringExpense: RecurringExpense,
  dueDate: LocalDate,
  id: string,
): ExpenseOccurrence {
  return {
    id,
    recurringExpenseId: recurringExpense.id,
    name: recurringExpense.name,
    dueDate,
    estimatedAmount: recurringExpense.estimatedAmount,
    status: "pending",
  };
}

function occurrenceKey(recurringExpenseId: string, dueDate: LocalDate): string {
  return `${recurringExpenseId}:${dueDate}`;
}

function generateOccurrences(
  state: SafeSpendStateV2,
  fromExclusive: LocalDate,
  toInclusive: LocalDate,
  services: DomainServices,
): ExpenseOccurrence[] {
  const occurrences = [...state.occurrences];
  const existingKeys = new Set(
    occurrences.map((occurrence) =>
      occurrenceKey(occurrence.recurringExpenseId, occurrence.dueDate),
    ),
  );

  for (const recurringExpense of state.recurringExpenses.filter(
    ({ isActive }) => isActive,
  )) {
    for (const dueDate of listMonthlyDueDates(
      fromExclusive,
      toInclusive,
      recurringExpense.dueDay,
    )) {
      if (compareLocalDates(dueDate, fromExclusive) <= 0) {
        continue;
      }

      const key = occurrenceKey(recurringExpense.id, dueDate);
      if (existingKeys.has(key)) {
        continue;
      }

      occurrences.push(
        makeOccurrence(recurringExpense, dueDate, services.createId()),
      );
      existingKeys.add(key);
    }
  }

  return occurrences;
}

function withValidProtectedAmount(state: SafeSpendStateV2): SafeSpendStateV2 {
  assertProtectedAmountRange(state);
  return state;
}

export function createInitialState(
  input: InitialStateInput,
  services: DomainServices,
): SafeSpendStateV2 {
  const cycleStartDate = assertLocalDate(input.cycleStartDate);
  const nextIncomeDate = assertLocalDate(input.nextIncomeDate);

  if (compareLocalDates(cycleStartDate, nextIncomeDate) > 0) {
    throw new Error("Next income date must not precede the cycle start date");
  }

  const recurringExpenses: RecurringExpense[] = [];
  const occurrences: ExpenseOccurrence[] = [];

  for (const recurringInput of input.recurringExpenses) {
    const recurringExpense = makeRecurringExpense(
      recurringInput,
      services.createId(),
    );
    recurringExpenses.push(recurringExpense);

    for (const dueDate of listMonthlyDueDates(
      cycleStartDate,
      nextIncomeDate,
      recurringExpense.dueDay,
    )) {
      occurrences.push(
        makeOccurrence(recurringExpense, dueDate, services.createId()),
      );
    }
  }

  return withValidProtectedAmount({
    version: 2,
    balanceRevision: 0,
    currentBalance: assertWon(input.currentBalance),
    safetyReserve: assertWon(input.safetyReserve),
    nextIncomeDate,
    recurringExpenses,
    occurrences,
    spendingRecords: [],
    updatedAt: services.now(),
  });
}

export function recordPurchase(
  state: SafeSpendStateV2,
  amount: Won,
  memo: string | undefined,
  services: DomainServices,
): SafeSpendStateV2 {
  const validatedAmount = assertDeductibleBalance(state, amount);

  if (validatedAmount === 0) {
    throw new Error("Purchase amount must be positive");
  }

  const trimmedMemo = memo?.trim();
  const record = {
    id: services.createId(),
    amount: validatedAmount,
    ...(trimmedMemo === undefined || trimmedMemo.length === 0
      ? {}
      : { memo: trimmedMemo }),
    spentAt: services.now(),
    balanceRevision: state.balanceRevision,
  };

  return {
    ...state,
    currentBalance: assertWon(state.currentBalance - validatedAmount),
    spendingRecords: [...state.spendingRecords, record],
    updatedAt: record.spentAt,
  };
}

export function deleteSpendingRecord(
  state: SafeSpendStateV2,
  recordId: string,
): SafeSpendStateV2 {
  const record = state.spendingRecords.find(({ id }) => id === recordId);

  if (record === undefined) {
    throw new Error(`Spending record not found: ${recordId}`);
  }

  return {
    ...state,
    currentBalance:
      record.balanceRevision === state.balanceRevision
        ? assertWon(state.currentBalance + assertWon(record.amount))
        : state.currentBalance,
    spendingRecords: state.spendingRecords.filter(({ id }) => id !== recordId),
  };
}

export function markOccurrencePaid(
  state: SafeSpendStateV2,
  occurrenceId: string,
  actualAmount: Won,
): SafeSpendStateV2 {
  const occurrence = findPendingOccurrence(state, occurrenceId);
  const validatedAmount = assertDeductibleBalance(state, actualAmount);
  const paid: ExpenseOccurrence = {
    ...occurrence,
    status: "paid",
    actualAmount: validatedAmount,
    balanceRevision: state.balanceRevision,
  };

  return {
    ...state,
    currentBalance: assertWon(state.currentBalance - validatedAmount),
    occurrences: replaceOccurrence(state, paid),
  };
}

export function markOccurrenceSkipped(
  state: SafeSpendStateV2,
  occurrenceId: string,
): SafeSpendStateV2 {
  const occurrence = findPendingOccurrence(state, occurrenceId);

  return {
    ...state,
    occurrences: replaceOccurrence(state, { ...occurrence, status: "skipped" }),
  };
}

export function postponePendingOccurrence(
  state: SafeSpendStateV2,
  occurrenceId: string,
  dueDate: LocalDate,
): SafeSpendStateV2 {
  const occurrence = findPendingOccurrence(state, occurrenceId);
  const postponedDueDate = assertLocalDate(dueDate);

  if (compareLocalDates(postponedDueDate, occurrence.dueDate) <= 0) {
    throw new Error("Postponed date must be after the current due date");
  }

  return withValidProtectedAmount({
    ...state,
    occurrences: replaceOccurrence(state, {
      ...occurrence,
      dueDate: postponedDueDate,
    }),
  });
}

export function revertOccurrence(
  state: SafeSpendStateV2,
  occurrenceId: string,
): SafeSpendStateV2 {
  const occurrence = findOccurrence(state, occurrenceId);

  if (occurrence.status === "pending") {
    throw new Error("Action requires a completed occurrence");
  }

  const pending: ExpenseOccurrence = {
    id: occurrence.id,
    recurringExpenseId: occurrence.recurringExpenseId,
    name: occurrence.name,
    dueDate: occurrence.dueDate,
    estimatedAmount: occurrence.estimatedAmount,
    status: "pending",
  };
  const restoredAmount =
    occurrence.status === "paid" &&
    occurrence.balanceRevision === state.balanceRevision
      ? assertWon(occurrence.actualAmount ?? 0)
      : 0;

  return withValidProtectedAmount({
    ...state,
    currentBalance: assertWon(state.currentBalance + restoredAmount),
    occurrences: replaceOccurrence(state, pending),
  });
}

export function editPendingOccurrence(
  state: SafeSpendStateV2,
  occurrenceId: string,
  input: { name: string; dueDate: LocalDate; estimatedAmount: Won },
): SafeSpendStateV2 {
  const occurrence = findPendingOccurrence(state, occurrenceId);
  const edited: ExpenseOccurrence = {
    ...occurrence,
    name: assertName(input.name),
    dueDate: assertLocalDate(input.dueDate),
    estimatedAmount: assertWon(input.estimatedAmount),
  };

  return withValidProtectedAmount({
    ...state,
    occurrences: replaceOccurrence(state, edited),
  });
}

export function addRecurringExpense(
  state: SafeSpendStateV2,
  input: {
    name: string;
    estimatedAmount: Won;
    dueDay: number;
    today: LocalDate;
  },
  services: DomainServices,
): SafeSpendStateV2 {
  const today = assertLocalDate(input.today);
  const recurringExpense = makeRecurringExpense(input, services.createId());
  const nextDueDate = listMonthlyDueDates(
    today,
    state.nextIncomeDate,
    recurringExpense.dueDay,
  )[0];
  const occurrences =
    nextDueDate === undefined
      ? state.occurrences
      : [
          ...state.occurrences,
          makeOccurrence(recurringExpense, nextDueDate, services.createId()),
        ];

  return withValidProtectedAmount({
    ...state,
    recurringExpenses: [...state.recurringExpenses, recurringExpense],
    occurrences,
    updatedAt: services.now(),
  });
}

export function updateRecurringExpense(
  state: SafeSpendStateV2,
  recurringExpenseId: string,
  input: {
    name: string;
    estimatedAmount: Won;
    dueDay: number;
    today: LocalDate;
  },
  services: DomainServices,
): SafeSpendStateV2 {
  const existing = state.recurringExpenses.find(
    ({ id }) => id === recurringExpenseId,
  );

  if (existing === undefined) {
    throw new Error(`Recurring expense not found: ${recurringExpenseId}`);
  }

  const updated: RecurringExpense = {
    ...existing,
    name: assertName(input.name),
    estimatedAmount: assertWon(input.estimatedAmount),
    dueDay: assertDueDay(input.dueDay),
  };
  const today = assertLocalDate(input.today);
  const protectedPending = state.occurrences.filter(
    (occurrence) =>
      occurrence.recurringExpenseId === recurringExpenseId &&
      occurrence.status === "pending" &&
      compareLocalDates(occurrence.dueDate, state.nextIncomeDate) <= 0,
  );
  const occurrences = state.occurrences.filter(
    (occurrence) => !protectedPending.some(({ id }) => id === occurrence.id),
  );
  const existingKeys = new Set(
    occurrences.map((occurrence) =>
      occurrenceKey(occurrence.recurringExpenseId, occurrence.dueDate),
    ),
  );

  if (protectedPending.length > 0) {
    for (const occurrence of protectedPending) {
      const dueDate = resolveMonthlyDueDate(occurrence.dueDate, updated.dueDay);
      const key = occurrenceKey(recurringExpenseId, dueDate);
      if (existingKeys.has(key)) {
        continue;
      }

      occurrences.push({
        ...occurrence,
        name: updated.name,
        estimatedAmount: updated.estimatedAmount,
        dueDate,
      });
      existingKeys.add(key);
    }
  } else {
    for (const dueDate of listMonthlyDueDates(
      today,
      state.nextIncomeDate,
      updated.dueDay,
    )) {
      const key = occurrenceKey(recurringExpenseId, dueDate);
      if (existingKeys.has(key)) {
        continue;
      }

      occurrences.push(makeOccurrence(updated, dueDate, services.createId()));
      existingKeys.add(key);
    }
  }

  return withValidProtectedAmount({
    ...state,
    recurringExpenses: state.recurringExpenses.map((item) =>
      item.id === recurringExpenseId ? updated : item,
    ),
    occurrences,
    updatedAt: services.now(),
  });
}

export function deactivateRecurringExpense(
  state: SafeSpendStateV2,
  recurringExpenseId: string,
): SafeSpendStateV2 {
  const existing = state.recurringExpenses.find(
    ({ id }) => id === recurringExpenseId,
  );

  if (existing === undefined) {
    throw new Error(`Recurring expense not found: ${recurringExpenseId}`);
  }

  return {
    ...state,
    recurringExpenses: state.recurringExpenses.map((item) =>
      item.id === recurringExpenseId ? { ...item, isActive: false } : item,
    ),
  };
}

export function updateCycleSettings(
  state: SafeSpendStateV2,
  input: { currentBalance: Won; safetyReserve: Won; nextIncomeDate: LocalDate },
  services: DomainServices,
): SafeSpendStateV2 {
  const currentBalance = assertWon(input.currentBalance);
  const nextIncomeDate = assertLocalDate(input.nextIncomeDate);
  const balanceRevision =
    currentBalance === state.currentBalance
      ? state.balanceRevision
      : assertWon(state.balanceRevision + 1);
  const updated = {
    ...state,
    balanceRevision,
    currentBalance,
    safetyReserve: assertWon(input.safetyReserve),
    nextIncomeDate,
  };
  const occurrences =
    compareLocalDates(nextIncomeDate, state.nextIncomeDate) > 0
      ? generateOccurrences(
          updated,
          state.nextIncomeDate,
          nextIncomeDate,
          services,
        )
      : state.occurrences;

  return withValidProtectedAmount({
    ...updated,
    occurrences,
  });
}

export function renewCycle(
  state: SafeSpendStateV2,
  input: {
    currentBalance: Won;
    receivedOn: LocalDate;
    nextIncomeDate: LocalDate;
  },
  services: DomainServices,
): SafeSpendStateV2 {
  const receivedOn = assertLocalDate(input.receivedOn);
  const nextIncomeDate = assertLocalDate(input.nextIncomeDate);

  if (compareLocalDates(receivedOn, nextIncomeDate) >= 0) {
    throw new Error("Next income date must be after the received date");
  }

  const fromExclusive =
    compareLocalDates(state.nextIncomeDate, receivedOn) <= 0
      ? state.nextIncomeDate
      : receivedOn;
  const occurrences = generateOccurrences(
    state,
    fromExclusive,
    nextIncomeDate,
    services,
  );

  return withValidProtectedAmount({
    ...state,
    balanceRevision: assertWon(state.balanceRevision + 1),
    currentBalance: assertWon(input.currentBalance),
    nextIncomeDate,
    occurrences,
    updatedAt: services.now(),
  });
}
