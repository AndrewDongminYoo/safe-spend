import type { IsoDateTime, LocalDate, Won } from "./types";

export interface SafeSpendStateV1 {
  version: 1;
  currentBalance: Won;
  safetyReserve: Won;
  nextIncomeDate: LocalDate;
  recurringExpenses: RecurringExpense[];
  occurrences: ExpenseOccurrence[];
  spendingRecords: SpendingRecord[];
  updatedAt: IsoDateTime;
}

export interface RecurringExpense {
  id: string;
  name: string;
  estimatedAmount: Won;
  dueDay: number;
  isActive: boolean;
}

export interface ExpenseOccurrence {
  id: string;
  recurringExpenseId: string;
  name: string;
  dueDate: LocalDate;
  estimatedAmount: Won;
  status: "pending" | "paid" | "skipped";
  actualAmount?: Won;
}

export interface SpendingRecord {
  id: string;
  amount: Won;
  memo?: string;
  spentAt: IsoDateTime;
}

export interface RecurringExpenseInput {
  name: string;
  estimatedAmount: Won;
  dueDay: number;
}

export interface InitialStateInput {
  currentBalance: Won;
  safetyReserve: Won;
  nextIncomeDate: LocalDate;
  cycleStartDate: LocalDate;
  recurringExpenses: RecurringExpenseInput[];
}

export interface BudgetSummary {
  reservedAmount: Won;
  rawSafeToSpend: number;
  safeToSpend: Won;
  shortfall: Won;
  remainingDays: number;
  dailyAllowance: Won;
}

export interface PurchasePreview extends BudgetSummary {
  purchaseAmount: Won;
  impactPercent: number | null;
  safeToSpendAfter: Won;
  shortfallAfter: Won;
  dailyAllowanceAfter: Won;
}

export interface DomainServices {
  createId(): string;
  now(): IsoDateTime;
}
