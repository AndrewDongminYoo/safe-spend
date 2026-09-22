export type ProductEvent =
  | {
      name: "onboarding_completed";
      properties: { hasRecurringExpense: boolean };
    }
  | {
      name: "purchase_previewed";
      properties: { result: "within_safe_amount" | "exceeds_safe_amount" };
    }
  | {
      name: "purchase_recorded";
      properties: { result: "within_safe_amount" | "exceeds_safe_amount" };
    }
  | { name: "expense_marked_paid"; properties: Record<string, never> }
  | { name: "cycle_renewed"; properties: Record<string, never> };

export function trackProductEvent(event: ProductEvent): void {
  void event;
}
