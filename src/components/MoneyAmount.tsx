import { formatWon } from "../domain/money";
import type { Won } from "../domain/types";

interface MoneyAmountProps {
  amount: Won;
  suffix?: string;
}

export function MoneyAmount({ amount, suffix = "원" }: MoneyAmountProps) {
  return (
    <h1
      aria-label={`${amount}원`}
      data-raw-amount={amount}
      style={{ margin: "8px 0", fontSize: 36, lineHeight: 1.3 }}
    >
      {formatWon(amount)}
      {suffix}
    </h1>
  );
}
