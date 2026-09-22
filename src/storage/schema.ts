import { compareLocalDates } from "../domain/calendar";
import { assertProtectedAmountRange } from "../domain/budget";
import { assertWon } from "../domain/money";
import type { SafeSpendStateV1 } from "../domain/model";

export type LoadResult =
  | { kind: "empty" }
  | { kind: "ready"; state: SafeSpendStateV1 }
  | { kind: "corrupt"; raw: string; reason: string }
  | { kind: "unavailable"; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${path} must be an object`);
  }

  return value;
}

function requireArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }

  return value;
}

function requireString(
  value: unknown,
  path: string,
  allowEmpty = false,
): string {
  if (typeof value !== "string" || (!allowEmpty && value.trim().length === 0)) {
    throw new Error(`${path} must be a non-empty string`);
  }

  return value;
}

function requireBoolean(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${path} must be a boolean`);
  }

  return value;
}

function requireWon(value: unknown, path: string): number {
  if (typeof value !== "number") {
    throw new Error(`${path} must be a number`);
  }

  try {
    return assertWon(value);
  } catch {
    throw new Error(`${path} must be a safe non-negative integer`);
  }
}

function requireDueDay(value: unknown, path: string): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 31
  ) {
    throw new Error(`${path} must be an integer between 1 and 31`);
  }

  return value;
}

function requireLocalDate(value: unknown, path: string): string {
  const date = requireString(value, path);

  try {
    compareLocalDates(date, date);
  } catch {
    throw new Error(`${path} must be a valid local date`);
  }

  return date;
}

function requireIsoDateTime(value: unknown, path: string): string {
  const dateTime = requireString(value, path);
  const parsed = new Date(dateTime);

  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString() !== dateTime) {
    throw new Error(`${path} must be an ISO date-time`);
  }

  return dateTime;
}

function validateRecurringExpense(value: unknown, index: number): void {
  const path = `recurringExpenses[${index}]`;
  const item = requireRecord(value, path);
  requireString(item.id, `${path}.id`);
  requireString(item.name, `${path}.name`);
  requireWon(item.estimatedAmount, `${path}.estimatedAmount`);
  requireDueDay(item.dueDay, `${path}.dueDay`);
  requireBoolean(item.isActive, `${path}.isActive`);
}

function validateOccurrence(value: unknown, index: number): void {
  const path = `occurrences[${index}]`;
  const item = requireRecord(value, path);
  requireString(item.id, `${path}.id`);
  requireString(item.recurringExpenseId, `${path}.recurringExpenseId`);
  requireString(item.name, `${path}.name`);
  requireLocalDate(item.dueDate, `${path}.dueDate`);
  requireWon(item.estimatedAmount, `${path}.estimatedAmount`);

  if (
    item.status !== "pending" &&
    item.status !== "paid" &&
    item.status !== "skipped"
  ) {
    throw new Error(`${path}.status must be pending, paid, or skipped`);
  }

  if (item.status === "paid") {
    requireWon(item.actualAmount, `${path}.actualAmount`);
  } else if (item.actualAmount !== undefined) {
    throw new Error(`${path}.actualAmount is only valid for paid occurrences`);
  }
}

function validateSpendingRecord(value: unknown, index: number): void {
  const path = `spendingRecords[${index}]`;
  const item = requireRecord(value, path);
  requireString(item.id, `${path}.id`);
  requireWon(item.amount, `${path}.amount`);

  if (item.memo !== undefined) {
    requireString(item.memo, `${path}.memo`);
  }

  requireIsoDateTime(item.spentAt, `${path}.spentAt`);
}

function validateState(value: unknown): SafeSpendStateV1 {
  const state = requireRecord(value, "snapshot");

  if (state.version !== 1) {
    throw new Error(`unsupported version: ${String(state.version)}`);
  }

  requireWon(state.currentBalance, "currentBalance");
  requireWon(state.safetyReserve, "safetyReserve");
  requireLocalDate(state.nextIncomeDate, "nextIncomeDate");
  requireArray(state.recurringExpenses, "recurringExpenses").forEach(
    validateRecurringExpense,
  );
  requireArray(state.occurrences, "occurrences").forEach(validateOccurrence);
  requireArray(state.spendingRecords, "spendingRecords").forEach(
    validateSpendingRecord,
  );
  requireIsoDateTime(state.updatedAt, "updatedAt");

  const validatedState = state as unknown as SafeSpendStateV1;
  assertProtectedAmountRange(validatedState);
  return validatedState;
}

export function parseStateSnapshot(raw: string): LoadResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { kind: "corrupt", raw, reason: "invalid JSON" };
  }

  try {
    return { kind: "ready", state: validateState(parsed) };
  } catch (error) {
    return {
      kind: "corrupt",
      raw,
      reason:
        error instanceof Error ? error.message : "snapshot validation failed",
    };
  }
}
