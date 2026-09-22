import { Button, TextField } from "@toss/tds-mobile";
import { useState } from "react";

import { WonTextField } from "../../components/WonTextField";
import { parseWonInput } from "../../domain/money";

export interface ExpenseEditorValue {
  name: string;
  amount: number;
  dueDay?: number;
  dueDate?: string;
}

interface ExpenseEditorProps {
  initial: ExpenseEditorValue;
  submitLabel: string;
  includeDueDay?: boolean;
  includeDueDate?: boolean;
  isSaving: boolean;
  onSubmit(value: ExpenseEditorValue): Promise<void> | void;
  onCancel(): void;
}

export function ExpenseEditor({
  initial,
  submitLabel,
  includeDueDay = false,
  includeDueDate = false,
  isSaving,
  onSubmit,
  onCancel,
}: ExpenseEditorProps) {
  const [name, setName] = useState(initial.name);
  const [amount, setAmount] = useState(
    initial.amount === 0 ? "" : initial.amount.toLocaleString("ko-KR"),
  );
  const [dueDay, setDueDay] = useState(initial.dueDay?.toString() ?? "");
  const [dueDate, setDueDate] = useState(initial.dueDate ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    try {
      const parsedAmount = parseWonInput(amount);
      const parsedDueDay = includeDueDay ? Number(dueDay) : undefined;

      if (
        name.trim().length === 0 ||
        (includeDueDay &&
          (!Number.isInteger(parsedDueDay) ||
            parsedDueDay === undefined ||
            parsedDueDay < 1 ||
            parsedDueDay > 31)) ||
        (includeDueDate && dueDate.length === 0)
      ) {
        throw new Error("invalid expense");
      }

      setError(null);
      await onSubmit({
        name: name.trim(),
        amount: parsedAmount,
        ...(parsedDueDay === undefined ? {} : { dueDay: parsedDueDay }),
        ...(includeDueDate ? { dueDate } : {}),
      });
    } catch {
      setError("이름, 금액, 일정을 확인해 주세요");
    }
  };

  return (
    <section
      aria-label={submitLabel}
      style={{ display: "grid", gap: 12, margin: "20px 0" }}
    >
      <TextField
        aria-label="고정지출 이름"
        variant="box"
        label="고정지출 이름"
        labelOption="sustain"
        value={name}
        onChange={(event) => setName(event.currentTarget.value)}
      />
      <WonTextField
        label="예정 금액"
        value={amount}
        onValueChange={setAmount}
      />
      {includeDueDay ? (
        <TextField
          aria-label="결제일"
          variant="box"
          label="결제일"
          labelOption="sustain"
          inputMode="numeric"
          suffix="일"
          value={dueDay}
          onChange={(event) => setDueDay(event.currentTarget.value)}
        />
      ) : null}
      {includeDueDate ? (
        <label style={{ display: "grid", gap: 8 }}>
          <span>이번 결제일</span>
          <input
            aria-label="이번 결제일"
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.currentTarget.value)}
            style={{ minHeight: 56, padding: "0 16px", font: "inherit" }}
          />
        </label>
      ) : null}
      {error === null ? null : <p role="alert">{error}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <Button variant="weak" disabled={isSaving} onClick={onCancel}>
          취소
        </Button>
        <Button disabled={isSaving} onClick={() => void submit()}>
          {submitLabel}
        </Button>
      </div>
    </section>
  );
}
