import { Badge, Button, ListRow, TextField } from "@toss/tds-mobile";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAppStore } from "../../app/app-store";
import { PageScaffold } from "../../components/PageScaffold";
import { WonTextField } from "../../components/WonTextField";
import { compareLocalDates } from "../../domain/calendar";
import { formatWon, parseWonInput } from "../../domain/money";
import type { DomainServices, RecurringExpenseInput } from "../../domain/model";
import { systemDomainServices } from "../../domain/services";
import { createInitialState } from "../../domain/transitions";

interface OnboardingPageProps {
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

export function OnboardingPage({
  today = getTodayInKorea(),
  domainServices = systemDomainServices,
}: OnboardingPageProps) {
  const { initialize, isSaving } = useAppStore();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [currentBalance, setCurrentBalance] = useState("");
  const [nextIncomeDate, setNextIncomeDate] = useState("");
  const [safetyReserve, setSafetyReserve] = useState("");
  const [recurringName, setRecurringName] = useState("");
  const [recurringAmount, setRecurringAmount] = useState("");
  const [recurringDueDay, setRecurringDueDay] = useState("");
  const [recurringExpenses, setRecurringExpenses] = useState<
    RecurringExpenseInput[]
  >([]);
  const [showErrors, setShowErrors] = useState(false);
  const [dateError, setDateError] = useState<string | null>(null);
  const [recurringError, setRecurringError] = useState<string | null>(null);

  const moveFromBalance = () => {
    try {
      parseWonInput(currentBalance);
      setShowErrors(false);
      setStep(1);
    } catch {
      setShowErrors(true);
    }
  };

  const moveFromDate = () => {
    try {
      if (
        nextIncomeDate.length === 0 ||
        compareLocalDates(nextIncomeDate, today) < 0
      ) {
        throw new Error("invalid date");
      }
      setDateError(null);
      setStep(2);
    } catch {
      setDateError("오늘 이후의 수입일을 선택해 주세요");
    }
  };

  const moveFromReserve = () => {
    try {
      parseWonInput(safetyReserve);
      setShowErrors(false);
      setStep(3);
    } catch {
      setShowErrors(true);
    }
  };

  const addExpense = () => {
    try {
      const name = recurringName.trim();
      const estimatedAmount = parseWonInput(recurringAmount);
      const dueDay = Number(recurringDueDay);

      if (
        name.length === 0 ||
        !Number.isInteger(dueDay) ||
        dueDay < 1 ||
        dueDay > 31
      ) {
        throw new Error("invalid recurring expense");
      }

      setRecurringExpenses((items) => [
        ...items,
        { name, estimatedAmount, dueDay },
      ]);
      setRecurringName("");
      setRecurringAmount("");
      setRecurringDueDay("");
      setRecurringError(null);
    } catch {
      setRecurringError("이름, 금액, 1~31일 사이의 결제일을 확인해 주세요");
    }
  };

  const complete = async () => {
    const nextState = createInitialState(
      {
        currentBalance: parseWonInput(currentBalance),
        safetyReserve: parseWonInput(safetyReserve),
        nextIncomeDate,
        recurringExpenses,
        cycleStartDate: today,
      },
      domainServices,
    );

    if (await initialize(nextState)) {
      void navigate("/");
    }
  };

  if (step === 0) {
    return (
      <PageScaffold
        title="계좌 연결 없이 시작해요"
        subtitle="다음 수입일까지 실제로 쓸 수 있는 돈을 계산해요."
      >
        <WonTextField
          label="현재 잔액"
          value={currentBalance}
          onValueChange={setCurrentBalance}
          showRequiredError={showErrors}
        />
        <Button
          display="block"
          style={{ marginTop: 24 }}
          onClick={moveFromBalance}
        >
          다음
        </Button>
      </PageScaffold>
    );
  }

  if (step === 1) {
    return (
      <PageScaffold
        title="다음 수입일"
        subtitle="월급이나 정기 수입이 들어오는 날이에요."
      >
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
        {dateError === null ? null : <p role="alert">{dateError}</p>}
        <Button
          display="block"
          style={{ marginTop: 24 }}
          onClick={moveFromDate}
        >
          다음
        </Button>
      </PageScaffold>
    );
  }

  if (step === 2) {
    return (
      <PageScaffold
        title="안전 여유금"
        subtitle="예상하지 못한 지출을 위해 남겨둘 금액이에요."
      >
        <WonTextField
          label="안전 여유금"
          value={safetyReserve}
          onValueChange={setSafetyReserve}
          showRequiredError={showErrors}
        />
        <Button
          display="block"
          style={{ marginTop: 24 }}
          onClick={moveFromReserve}
        >
          다음
        </Button>
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      title="고정지출"
      subtitle="수입일 전까지 빠져나갈 예정인 돈을 추가해요."
    >
      <div style={{ display: "grid", gap: 12 }}>
        <TextField
          aria-label="고정지출 이름"
          variant="box"
          label="고정지출 이름"
          labelOption="sustain"
          value={recurringName}
          onChange={(event) => setRecurringName(event.currentTarget.value)}
        />
        <WonTextField
          label="예정 금액"
          value={recurringAmount}
          onValueChange={setRecurringAmount}
        />
        <TextField
          aria-label="결제일"
          variant="box"
          label="결제일"
          labelOption="sustain"
          inputMode="numeric"
          suffix="일"
          value={recurringDueDay}
          onChange={(event) => setRecurringDueDay(event.currentTarget.value)}
        />
      </div>
      {recurringError === null ? null : <p role="alert">{recurringError}</p>}
      <Button
        variant="weak"
        display="block"
        style={{ marginTop: 12 }}
        onClick={addExpense}
      >
        고정지출 추가
      </Button>
      {recurringExpenses.length === 0 ? null : (
        <ul style={{ listStyle: "none", margin: "16px -24px", padding: 0 }}>
          {recurringExpenses.map((expense, index) => (
            <ListRow
              key={`${expense.name}-${index}`}
              contents={`${expense.name} · ${formatWon(expense.estimatedAmount)}원`}
              right={
                <Badge size="small" variant="weak" color="blue">
                  매월 {expense.dueDay}일
                </Badge>
              }
            />
          ))}
        </ul>
      )}
      <Button
        display="block"
        style={{ marginTop: 24 }}
        disabled={isSaving}
        onClick={() => void complete()}
      >
        계산 결과 보기
      </Button>
    </PageScaffold>
  );
}
