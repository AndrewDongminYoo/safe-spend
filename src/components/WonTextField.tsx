import { TextField } from "@toss/tds-mobile";
import { useId } from "react";

import { formatWon, parseWonInput } from "../domain/money";

interface WonTextFieldProps {
  label: string;
  value: string;
  onValueChange(value: string): void;
  showRequiredError?: boolean;
}

function formatAmountInput(value: string): string {
  const normalized = value.replace(/,/g, "");

  if (!/^\d+$/.test(normalized)) {
    return value;
  }

  const amount = Number(normalized);
  return Number.isSafeInteger(amount) ? formatWon(amount) : value;
}

export function WonTextField({
  label,
  value,
  onValueChange,
  showRequiredError = false,
}: WonTextFieldProps) {
  const accessibleAmountId = useId();
  let hasInvalidAmount = false;
  let accessibleAmount: number | null = null;

  if (value.length > 0) {
    try {
      accessibleAmount = parseWonInput(value);
    } catch {
      hasInvalidAmount = true;
    }
  }

  const hasError =
    hasInvalidAmount || (showRequiredError && value.length === 0);

  return (
    <>
      <TextField
        aria-describedby={
          accessibleAmount === null ? undefined : accessibleAmountId
        }
        aria-label={label}
        variant="box"
        label={label}
        labelOption="sustain"
        inputMode="numeric"
        suffix="원"
        value={value}
        hasError={hasError}
        help={hasError ? "0 이상의 정수 금액을 입력해 주세요" : undefined}
        onChange={(event) =>
          onValueChange(formatAmountInput(event.currentTarget.value))
        }
      />
      {accessibleAmount === null ? null : (
        <span
          id={accessibleAmountId}
          style={{
            position: "absolute",
            width: 1,
            height: 1,
            padding: 0,
            margin: -1,
            overflow: "hidden",
            clip: "rect(0, 0, 0, 0)",
            whiteSpace: "nowrap",
            border: 0,
          }}
        >
          {label} 입력값 {accessibleAmount}원
        </span>
      )}
    </>
  );
}
