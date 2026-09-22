import { compareLocalDates, listMonthlyDueDates } from "./calendar";
import { assertProtectedAmountRange } from "./budget";
import { assertWon } from "./money";
import type {
  DomainServices,
  ExpenseOccurrence,
  InitialStateInput,
  RecurringExpense,
  RecurringExpenseInput,
  SafeSpendStateV1,
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

function assertDeductibleBalance(state: SafeSpendStateV1, amount: Won): Won {
  const validatedAmount = assertWon(amount);

  if (validatedAmount > assertWon(state.currentBalance)) {
    throw new Error("Amount cannot exceed the current balance");
  }

  return validatedAmount;
}

function findOccurrence(
  state: SafeSpendStateV1,
  occurrenceId: string,
): ExpenseOccurrence {
  const occurrence = state.occurrences.find(({ id }) => id === occurrenceId);

  if (occurrence === undefined) {
    throw new Error(`Expense occurrence not found: ${occurrenceId}`);
  }

  return occurrence;
}

function findPendingOccurrence(
  state: SafeSpendStateV1,
  occurrenceId: string,
): ExpenseOccurrence {
  const occurrence = findOccurrence(state, occurrenceId);

  if (occurrence.status !== "pending") {
    throw new Error("Action requires a pending occurrence");
  }

  return occurrence;
}

function replaceOccurrence(
  state: SafeSpendStateV1,
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

function withValidProtectedAmount(state: SafeSpendStateV1): SafeSpendStateV1 {
  assertProtectedAmountRange(state);
  return state;
}

export function createInitialState(
  input: InitialStateInput,
  services: DomainServices,
): SafeSpendStateV1 {
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
    version: 1,
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
  state: SafeSpendStateV1,
  amount: Won,
  memo: string | undefined,
  services: DomainServices,
): SafeSpendStateV1 {
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
  };

  return {
    ...state,
    currentBalance: assertWon(state.currentBalance - validatedAmount),
    spendingRecords: [...state.spendingRecords, record],
    updatedAt: record.spentAt,
  };
}

export function deleteSpendingRecord(
  state: SafeSpendStateV1,
  recordId: string,
): SafeSpendStateV1 {
  const record = state.spendingRecords.find(({ id }) => id === recordId);

  if (record === undefined) {
    throw new Error(`Spending record not found: ${recordId}`);
  }

  return {
    ...state,
    currentBalance: assertWon(state.currentBalance + assertWon(record.amount)),
    spendingRecords: state.spendingRecords.filter(({ id }) => id !== recordId),
  };
}

export function markOccurrencePaid(
  state: SafeSpendStateV1,
  occurrenceId: string,
  actualAmount: Won,
): SafeSpendStateV1 {
  const occurrence = findPendingOccurrence(state, occurrenceId);
  const validatedAmount = assertDeductibleBalance(state, actualAmount);
  const paid: ExpenseOccurrence = {
    ...occurrence,
    status: "paid",
    actualAmount: validatedAmount,
  };

  return {
    ...state,
    currentBalance: assertWon(state.currentBalance - validatedAmount),
    occurrences: replaceOccurrence(state, paid),
  };
}

export function markOccurrenceSkipped(
  state: SafeSpendStateV1,
  occurrenceId: string,
): SafeSpendStateV1 {
  const occurrence = findPendingOccurrence(state, occurrenceId);

  return {
    ...state,
    occurrences: replaceOccurrence(state, { ...occurrence, status: "skipped" }),
  };
}

export function revertOccurrence(
  state: SafeSpendStateV1,
  occurrenceId: string,
): SafeSpendStateV1 {
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
    occurrence.status === "paid" ? assertWon(occurrence.actualAmount ?? 0) : 0;

  return withValidProtectedAmount({
    ...state,
    currentBalance: assertWon(state.currentBalance + restoredAmount),
    occurrences: replaceOccurrence(state, pending),
  });
}

export function editPendingOccurrence(
  state: SafeSpendStateV1,
  occurrenceId: string,
  input: { name: string; dueDate: LocalDate; estimatedAmount: Won },
): SafeSpendStateV1 {
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
  state: SafeSpendStateV1,
  input: {
    name: string;
    estimatedAmount: Won;
    dueDay: number;
    today: LocalDate;
  },
  services: DomainServices,
): SafeSpendStateV1 {
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
  state: SafeSpendStateV1,
  recurringExpenseId: string,
  input: {
    name: string;
    estimatedAmount: Won;
    dueDay: number;
    today: LocalDate;
  },
  services: DomainServices,
): SafeSpendStateV1 {
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
  const nextDueDate = listMonthlyDueDates(
    today,
    state.nextIncomeDate,
    updated.dueDay,
  )[0];
  const hasCurrentCycleOccurrence = state.occurrences.some(
    (occurrence) =>
      occurrence.recurringExpenseId === recurringExpenseId &&
      compareLocalDates(occurrence.dueDate, today) >= 0 &&
      compareLocalDates(occurrence.dueDate, state.nextIncomeDate) <= 0,
  );
  const occurrences =
    nextDueDate === undefined || hasCurrentCycleOccurrence
      ? state.occurrences
      : [
          ...state.occurrences,
          makeOccurrence(updated, nextDueDate, services.createId()),
        ];

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
  state: SafeSpendStateV1,
  recurringExpenseId: string,
): SafeSpendStateV1 {
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
  state: SafeSpendStateV1,
  input: { currentBalance: Won; safetyReserve: Won; nextIncomeDate: LocalDate },
): SafeSpendStateV1 {
  return withValidProtectedAmount({
    ...state,
    currentBalance: assertWon(input.currentBalance),
    safetyReserve: assertWon(input.safetyReserve),
    nextIncomeDate: assertLocalDate(input.nextIncomeDate),
  });
}

export function renewCycle(
  state: SafeSpendStateV1,
  input: {
    currentBalance: Won;
    receivedOn: LocalDate;
    nextIncomeDate: LocalDate;
  },
  services: DomainServices,
): SafeSpendStateV1 {
  const receivedOn = assertLocalDate(input.receivedOn);
  const nextIncomeDate = assertLocalDate(input.nextIncomeDate);

  if (compareLocalDates(receivedOn, nextIncomeDate) >= 0) {
    throw new Error("Next income date must be after the received date");
  }

  const newOccurrences: ExpenseOccurrence[] = [];

  for (const recurringExpense of state.recurringExpenses.filter(
    ({ isActive }) => isActive,
  )) {
    for (const dueDate of listMonthlyDueDates(
      receivedOn,
      nextIncomeDate,
      recurringExpense.dueDay,
    )) {
      if (compareLocalDates(dueDate, receivedOn) <= 0) {
        continue;
      }

      const alreadyExists = state.occurrences.some(
        (occurrence) =>
          occurrence.recurringExpenseId === recurringExpense.id &&
          occurrence.dueDate === dueDate,
      );

      if (!alreadyExists) {
        newOccurrences.push(
          makeOccurrence(recurringExpense, dueDate, services.createId()),
        );
      }
    }
  }

  return withValidProtectedAmount({
    ...state,
    currentBalance: assertWon(input.currentBalance),
    nextIncomeDate,
    occurrences: [...state.occurrences, ...newOccurrences],
    updatedAt: services.now(),
  });
}
