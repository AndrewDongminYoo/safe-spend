import { TableRow } from "@toss/tds-mobile";

import { formatWon } from "../domain/money";
import type { BudgetSummary, SafeSpendStateV1 } from "../domain/model";

interface BudgetBreakdownProps {
  state: SafeSpendStateV1;
  budget: BudgetSummary;
}

export function BudgetBreakdown({ state, budget }: BudgetBreakdownProps) {
  return (
    <section aria-label="금액 구성" style={{ margin: "24px -24px" }}>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        <TableRow
          align="space-between"
          left={`현재 잔액 ${formatWon(state.currentBalance)}원`}
          right={null}
        />
        <TableRow
          align="space-between"
          left={`고정지출 ${formatWon(budget.reservedAmount)}원`}
          right={null}
        />
        <TableRow
          align="space-between"
          left={`안전 여유금 ${formatWon(state.safetyReserve)}원`}
          right={null}
        />
      </ul>
    </section>
  );
}
