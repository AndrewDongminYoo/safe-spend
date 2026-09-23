import { calendarDaysBetween, compareLocalDates } from "./calendar";
import { assertWon } from "./money";
import type { BudgetSummary, PurchasePreview, SafeSpendStateV2 } from "./model";
import type { LocalDate, Won } from "./types";

export function assertProtectedAmountRange(state: SafeSpendStateV2): void {
  const reservedAmount = state.occurrences.reduce((total, occurrence) => {
    if (
      occurrence.status !== "pending" ||
      compareLocalDates(occurrence.dueDate, state.nextIncomeDate) > 0
    ) {
      return total;
    }

    const nextTotal = total + assertWon(occurrence.estimatedAmount);
    if (!Number.isSafeInteger(nextTotal)) {
      throw new Error("Reserved amount exceeds the supported won range");
    }

    return nextTotal;
  }, 0);

  if (!Number.isSafeInteger(reservedAmount + assertWon(state.safetyReserve))) {
    throw new Error("Protected amount exceeds the supported won range");
  }
}

export function calculateBudget(
  state: SafeSpendStateV2,
  today: LocalDate,
): BudgetSummary {
  const currentBalance = assertWon(state.currentBalance);
  const safetyReserve = assertWon(state.safetyReserve);
  assertProtectedAmountRange(state);
  const reservedAmount = state.occurrences.reduce((total, occurrence) => {
    if (
      occurrence.status !== "pending" ||
      compareLocalDates(occurrence.dueDate, state.nextIncomeDate) > 0
    ) {
      return total;
    }

    return total + occurrence.estimatedAmount;
  }, 0);
  const protectedAmount = reservedAmount + safetyReserve;
  const rawSafeToSpend = currentBalance - protectedAmount;
  const safeToSpend = assertWon(Math.max(rawSafeToSpend, 0));
  const shortfall = assertWon(Math.max(-rawSafeToSpend, 0));
  const remainingDays = Math.max(
    calendarDaysBetween(today, state.nextIncomeDate),
    1,
  );
  const dailyAllowance = assertWon(Math.floor(safeToSpend / remainingDays));

  return {
    reservedAmount,
    rawSafeToSpend,
    safeToSpend,
    shortfall,
    remainingDays,
    dailyAllowance,
  };
}

export function previewPurchase(
  state: SafeSpendStateV2,
  today: LocalDate,
  purchaseAmount: Won,
): PurchasePreview {
  const amount = assertWon(purchaseAmount);
  const budget = calculateBudget(state, today);
  const rawSafeToSpendAfter = budget.rawSafeToSpend - amount;

  if (!Number.isSafeInteger(rawSafeToSpendAfter)) {
    throw new Error("Purchase preview exceeds the supported won range");
  }

  const safeToSpendAfter = assertWon(Math.max(rawSafeToSpendAfter, 0));
  const shortfallAfter = assertWon(Math.max(-rawSafeToSpendAfter, 0));

  return {
    ...budget,
    purchaseAmount: amount,
    impactPercent:
      budget.safeToSpend === 0 ? null : (amount / budget.safeToSpend) * 100,
    safeToSpendAfter,
    shortfallAfter,
    dailyAllowanceAfter: assertWon(
      Math.floor(safeToSpendAfter / budget.remainingDays),
    ),
  };
}
