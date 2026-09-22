import { Badge, Button, ListRow } from "@toss/tds-mobile";
import { useNavigate } from "react-router-dom";

import { useAppStore } from "../../app/app-store";
import { BudgetBreakdown } from "../../components/BudgetBreakdown";
import { MoneyAmount } from "../../components/MoneyAmount";
import { PageScaffold } from "../../components/PageScaffold";
import { calculateBudget } from "../../domain/budget";
import { compareLocalDates } from "../../domain/calendar";
import { formatWon } from "../../domain/money";

interface HomePageProps {
  today?: string;
}

function getTodayInKorea(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function HomePage({ today = getTodayInKorea() }: HomePageProps) {
  const { state } = useAppStore();
  const navigate = useNavigate();

  if (state === null) {
    return null;
  }

  const budget = calculateBudget(state, today);
  const pendingOccurrences = state.occurrences
    .filter(
      (occurrence) =>
        occurrence.status === "pending" &&
        compareLocalDates(occurrence.dueDate, state.nextIncomeDate) <= 0,
    )
    .sort((left, right) => compareLocalDates(left.dueDate, right.dueDate));

  return (
    <PageScaffold
      title="다음 수입일까지 써도 되는 돈"
      subtitle={`${budget.remainingDays}일 남았어요`}
    >
      {budget.shortfall > 0 ? (
        <h1 style={{ margin: "8px 0", fontSize: 32 }}>
          {formatWon(budget.shortfall)}원이 부족해요
        </h1>
      ) : (
        <MoneyAmount amount={budget.safeToSpend} />
      )}
      <p style={{ margin: "4px 0 0", color: "#4e5968" }}>
        하루 {formatWon(budget.dailyAllowance)}원
      </p>
      <BudgetBreakdown state={state} budget={budget} />
      {pendingOccurrences.length === 0 ? null : (
        <section
          aria-label="다가오는 고정지출"
          style={{ margin: "0 -24px 24px" }}
        >
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {pendingOccurrences.slice(0, 3).map((occurrence) => (
              <ListRow
                key={occurrence.id}
                contents={`${occurrence.name} · ${formatWon(occurrence.estimatedAmount)}원`}
                right={
                  <Badge size="small" variant="weak" color="blue">
                    {occurrence.dueDate.slice(5).replace("-", ".")} 예정
                  </Badge>
                }
              />
            ))}
          </ul>
        </section>
      )}
      <Button display="block" onClick={() => void navigate("/spend")}>
        지출 영향 확인하기
      </Button>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
          marginTop: 8,
        }}
      >
        <Button variant="weak" onClick={() => void navigate("/expenses")}>
          고정지출
        </Button>
        <Button variant="weak" onClick={() => void navigate("/settings")}>
          설정
        </Button>
      </div>
    </PageScaffold>
  );
}
