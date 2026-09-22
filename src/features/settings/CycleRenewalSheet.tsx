import { Button } from "@toss/tds-mobile";
import { useState } from "react";

import { WonTextField } from "../../components/WonTextField";
import { compareLocalDates } from "../../domain/calendar";
import { parseWonInput } from "../../domain/money";

interface CycleRenewalSheetProps {
  today: string;
  isSaving: boolean;
  onCancel(): void;
  onRenew(input: {
    currentBalance: number;
    nextIncomeDate: string;
  }): Promise<void> | void;
}

export function CycleRenewalSheet({
  today,
  isSaving,
  onCancel,
  onRenew,
}: CycleRenewalSheetProps) {
  const [currentBalance, setCurrentBalance] = useState("");
  const [nextIncomeDate, setNextIncomeDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    try {
      const balance = parseWonInput(currentBalance);
      if (compareLocalDates(nextIncomeDate, today) <= 0) {
        throw new Error("invalid next income date");
      }
      setError(null);
      await onRenew({ currentBalance: balance, nextIncomeDate });
    } catch {
      setError("현재 잔액과 다음 수입일을 확인해 주세요");
    }
  };

  return (
    <section
      aria-label="새 주기 시작"
      style={{ display: "grid", gap: 12, marginTop: 16 }}
    >
      <WonTextField
        label="현재 잔액"
        value={currentBalance}
        onValueChange={setCurrentBalance}
      />
      <label style={{ display: "grid", gap: 8 }}>
        <span>다음 수입일</span>
        <input
          aria-label="다음 수입일"
          type="date"
          min={today}
          value={nextIncomeDate}
          onChange={(event) => setNextIncomeDate(event.currentTarget.value)}
          style={{ minHeight: 56, padding: "0 16px", font: "inherit" }}
        />
      </label>
      {error === null ? null : <p role="alert">{error}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Button variant="weak" disabled={isSaving} onClick={onCancel}>
          취소
        </Button>
        <Button disabled={isSaving} onClick={() => void submit()}>
          새 주기 시작하기
        </Button>
      </div>
    </section>
  );
}
