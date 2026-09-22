import { Badge, Button, TableRow, TextField } from "@toss/tds-mobile";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { trackProductEvent } from "../../analytics/product-events";
import { useAppStore } from "../../app/app-store";
import { PageScaffold } from "../../components/PageScaffold";
import { WonTextField } from "../../components/WonTextField";
import { previewPurchase } from "../../domain/budget";
import { formatWon, parseWonInput } from "../../domain/money";
import type { DomainServices } from "../../domain/model";
import { systemDomainServices } from "../../domain/services";
import { recordPurchase } from "../../domain/transitions";

interface SpendPageProps {
  today?: string;
  domainServices?: DomainServices;
}

function getTodayInKorea(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function SpendPage({
  today = getTodayInKorea(),
  domainServices = systemDomainServices,
}: SpendPageProps) {
  const { state, mutate, isSaving } = useAppStore();
  const navigate = useNavigate();
  const [amountInput, setAmountInput] = useState("");
  const [memo, setMemo] = useState("");

  const amount = useMemo(() => {
    try {
      return parseWonInput(amountInput);
    } catch {
      return null;
    }
  }, [amountInput]);
  const exceedsCurrentBalance =
    state !== null && amount !== null && amount > state.currentBalance;
  const { preview, previewError } = useMemo(() => {
    if (state === null || amount === null || amount === 0) {
      return { preview: null, previewError: null };
    }

    try {
      return {
        preview: previewPurchase(state, today, amount),
        previewError: null,
      };
    } catch {
      return {
        preview: null,
        previewError: "계산할 수 있는 금액 범위를 넘었어요",
      };
    }
  }, [amount, state, today]);
  const result =
    preview === null || preview.purchaseAmount <= preview.safeToSpend
      ? "within_safe_amount"
      : "exceeds_safe_amount";
  const previewAmount = preview?.purchaseAmount ?? null;

  useEffect(() => {
    if (previewAmount !== null && previewAmount > 0) {
      trackProductEvent({ name: "purchase_previewed", properties: { result } });
    }
  }, [previewAmount, result]);

  if (state === null) {
    return null;
  }

  const exceedsSafeAmount =
    preview !== null && preview.purchaseAmount > preview.safeToSpend;
  const record = async () => {
    if (amount === null || amount === 0 || exceedsCurrentBalance) {
      return;
    }

    const saved = await mutate((current) =>
      recordPurchase(current, amount, memo, domainServices),
    );

    if (saved) {
      trackProductEvent({ name: "purchase_recorded", properties: { result } });
      void navigate("/");
    }
  };

  return (
    <PageScaffold
      title="지출 영향 확인하기"
      subtitle="결제 전에 남는 금액과 하루 예산을 확인해요."
    >
      <div style={{ display: "grid", gap: 12 }}>
        <WonTextField
          label="지출 금액"
          value={amountInput}
          onValueChange={setAmountInput}
        />
        <TextField
          aria-label="메모"
          variant="box"
          label="메모"
          labelOption="sustain"
          placeholder="선택 사항"
          value={memo}
          onChange={(event) => setMemo(event.currentTarget.value)}
        />
      </div>
      {amountInput.length > 0 && amount === 0 ? (
        <p role="alert">0원보다 큰 금액을 입력해 주세요</p>
      ) : null}
      {exceedsCurrentBalance ? (
        <p role="alert">현재 잔액보다 큰 금액은 기록할 수 없어요</p>
      ) : null}
      {previewError === null ? null : <p role="alert">{previewError}</p>}
      {preview === null ? null : (
        <section
          aria-label="지출 영향"
          aria-live="polite"
          style={{ margin: "24px -24px" }}
        >
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            <TableRow
              align="space-between"
              left={`써도 되는 돈의 ${preview.impactPercent?.toFixed(1) ?? "-"}%`}
              right={
                <Badge
                  size="small"
                  variant="weak"
                  color={exceedsSafeAmount ? "red" : "blue"}
                >
                  {exceedsSafeAmount ? "초과" : "범위 안"}
                </Badge>
              }
            />
            <TableRow
              align="space-between"
              left={`지출 후 ${formatWon(preview.safeToSpendAfter)}원`}
              right={null}
            />
            <TableRow
              align="space-between"
              left={`하루 ${formatWon(preview.dailyAllowanceAfter)}원`}
              right={null}
            />
          </ul>
          {exceedsSafeAmount ? (
            <p role="alert" style={{ padding: "0 24px", color: "#d22030" }}>
              써도 되는 돈보다{" "}
              {formatWon(preview.purchaseAmount - preview.safeToSpend)}원 많아요
            </p>
          ) : null}
        </section>
      )}
      <div style={{ display: "grid", gap: 8 }}>
        <Button
          display="block"
          disabled={
            amount === null || amount === 0 || exceedsCurrentBalance || isSaving
          }
          onClick={() => void record()}
        >
          지출로 기록하기
        </Button>
        <Button
          variant="weak"
          display="block"
          onClick={() => void navigate("/")}
        >
          계산만 하기
        </Button>
      </div>
    </PageScaffold>
  );
}
