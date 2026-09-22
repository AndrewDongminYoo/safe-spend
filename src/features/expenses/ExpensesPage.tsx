import { Badge, Button, ListRow } from "@toss/tds-mobile";
import { useState } from "react";

import { trackProductEvent } from "../../analytics/product-events";
import { useAppStore } from "../../app/app-store";
import { PageScaffold } from "../../components/PageScaffold";
import { WonTextField } from "../../components/WonTextField";
import { compareLocalDates } from "../../domain/calendar";
import { formatWon, parseWonInput } from "../../domain/money";
import type {
  DomainServices,
  ExpenseOccurrence,
  RecurringExpense,
} from "../../domain/model";
import { systemDomainServices } from "../../domain/services";
import {
  addRecurringExpense,
  deactivateRecurringExpense,
  editPendingOccurrence,
  markOccurrencePaid,
  markOccurrenceSkipped,
  revertOccurrence,
  updateRecurringExpense,
} from "../../domain/transitions";
import { ExpenseEditor, type ExpenseEditorValue } from "./ExpenseEditor";

interface ExpensesPageProps {
  today?: string;
  domainServices?: DomainServices;
}

type EditorState =
  | { kind: "none" }
  | { kind: "pay"; occurrence: ExpenseOccurrence }
  | { kind: "occurrence"; occurrence: ExpenseOccurrence }
  | { kind: "add-definition" }
  | { kind: "definition"; expense: RecurringExpense };

function getTodayInKorea(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const statusOrder = { pending: 0, paid: 1, skipped: 1 } as const;

export function ExpensesPage({
  today = getTodayInKorea(),
  domainServices = systemDomainServices,
}: ExpensesPageProps) {
  const { state, mutate, isSaving } = useAppStore();
  const [editor, setEditor] = useState<EditorState>({ kind: "none" });
  const [actualAmount, setActualAmount] = useState("");
  const [paymentError, setPaymentError] = useState<string | null>(null);

  if (state === null) {
    return null;
  }

  const occurrences = [...state.occurrences].sort((left, right) => {
    const statusDifference =
      statusOrder[left.status] - statusOrder[right.status];
    return statusDifference === 0
      ? compareLocalDates(left.dueDate, right.dueDate)
      : statusDifference;
  });

  const openPayment = (occurrence: ExpenseOccurrence) => {
    setActualAmount(formatWon(occurrence.estimatedAmount));
    setPaymentError(null);
    setEditor({ kind: "pay", occurrence });
  };

  const pay = async () => {
    if (editor.kind !== "pay") {
      return;
    }

    try {
      const amount = parseWonInput(actualAmount);
      if (amount > state.currentBalance) {
        setPaymentError("현재 잔액보다 큰 금액은 납부할 수 없어요");
        return;
      }

      setPaymentError(null);
      const saved = await mutate((current) =>
        markOccurrencePaid(current, editor.occurrence.id, amount),
      );
      if (saved) {
        trackProductEvent({ name: "expense_marked_paid", properties: {} });
        setEditor({ kind: "none" });
      }
    } catch {
      setPaymentError("실제 출금액을 확인해 주세요");
    }
  };

  const saveOccurrence = async (value: ExpenseEditorValue) => {
    if (editor.kind !== "occurrence" || value.dueDate === undefined) {
      return;
    }

    if (
      await mutate((current) =>
        editPendingOccurrence(current, editor.occurrence.id, {
          name: value.name,
          dueDate: value.dueDate!,
          estimatedAmount: value.amount,
        }),
      )
    ) {
      setEditor({ kind: "none" });
    }
  };

  const saveDefinition = async (value: ExpenseEditorValue) => {
    if (value.dueDay === undefined) {
      return;
    }

    const saved = await mutate((current) =>
      editor.kind === "definition"
        ? updateRecurringExpense(current, editor.expense.id, {
            name: value.name,
            estimatedAmount: value.amount,
            dueDay: value.dueDay!,
          })
        : addRecurringExpense(
            current,
            {
              name: value.name,
              estimatedAmount: value.amount,
              dueDay: value.dueDay!,
              today,
            },
            domainServices,
          ),
    );

    if (saved) {
      setEditor({ kind: "none" });
    }
  };

  return (
    <PageScaffold
      title="고정지출"
      subtitle="이번 주기의 예정, 납부, 건너뛴 내역이에요."
    >
      <section aria-label="이번 주기">
        <ul style={{ listStyle: "none", margin: "0 -24px", padding: 0 }}>
          {occurrences.map((occurrence) => (
            <ListRow
              key={occurrence.id}
              data-testid="expense-row"
              verticalPadding="large"
              contents={
                <ListRow.Texts
                  type="2RowTypeA"
                  top={occurrence.name}
                  bottom={`${occurrence.dueDate} · ${formatWon(
                    occurrence.actualAmount ?? occurrence.estimatedAmount,
                  )}원`}
                />
              }
              right={
                <Badge
                  size="small"
                  variant="weak"
                  color={
                    occurrence.status === "paid"
                      ? "green"
                      : occurrence.status === "skipped"
                        ? "elephant"
                        : "blue"
                  }
                >
                  {occurrence.status === "paid"
                    ? "납부 완료"
                    : occurrence.status === "skipped"
                      ? "건너뜀"
                      : "예정"}
                </Badge>
              }
            >
              {null}
            </ListRow>
          ))}
        </ul>
        {occurrences.map((occurrence) => (
          <div
            key={`${occurrence.id}-actions`}
            style={{ display: "flex", gap: 6, margin: "8px 0" }}
          >
            {occurrence.status === "pending" ? (
              <>
                <Button
                  size="small"
                  variant="weak"
                  disabled={isSaving}
                  onClick={() => openPayment(occurrence)}
                >
                  {occurrence.name} 납부 처리
                </Button>
                <Button
                  size="small"
                  variant="weak"
                  disabled={isSaving}
                  onClick={() =>
                    void mutate((current) =>
                      markOccurrenceSkipped(current, occurrence.id),
                    )
                  }
                >
                  {occurrence.name} 건너뛰기
                </Button>
                <Button
                  size="small"
                  variant="weak"
                  disabled={isSaving}
                  onClick={() => setEditor({ kind: "occurrence", occurrence })}
                >
                  {occurrence.name} 이번 일정 수정
                </Button>
              </>
            ) : (
              <Button
                size="small"
                variant="weak"
                disabled={isSaving}
                onClick={() =>
                  void mutate((current) =>
                    revertOccurrence(current, occurrence.id),
                  )
                }
              >
                {occurrence.name} 되돌리기
              </Button>
            )}
          </div>
        ))}
      </section>

      {editor.kind === "pay" ? (
        <section
          aria-label="납부 처리"
          style={{ display: "grid", gap: 12, margin: "24px 0" }}
        >
          <WonTextField
            label="실제 출금액"
            value={actualAmount}
            onValueChange={(value) => {
              setActualAmount(value);
              setPaymentError(null);
            }}
          />
          {paymentError === null ? null : <p role="alert">{paymentError}</p>}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <Button
              variant="weak"
              disabled={isSaving}
              onClick={() => setEditor({ kind: "none" })}
            >
              취소
            </Button>
            <Button disabled={isSaving} onClick={() => void pay()}>
              납부 완료
            </Button>
          </div>
        </section>
      ) : null}

      {editor.kind === "occurrence" ? (
        <ExpenseEditor
          initial={{
            name: editor.occurrence.name,
            amount: editor.occurrence.estimatedAmount,
            dueDate: editor.occurrence.dueDate,
          }}
          includeDueDate
          submitLabel="이번 일정 저장"
          isSaving={isSaving}
          onCancel={() => setEditor({ kind: "none" })}
          onSubmit={saveOccurrence}
        />
      ) : null}

      <section aria-label="반복 설정" style={{ marginTop: 32 }}>
        <h2>반복 설정</h2>
        <ul style={{ listStyle: "none", margin: "0 -24px", padding: 0 }}>
          {state.recurringExpenses.map((expense) => (
            <ListRow
              key={expense.id}
              contents={`${expense.name} · 매월 ${expense.dueDay}일`}
              right={
                <Badge
                  size="small"
                  variant="weak"
                  color={expense.isActive ? "blue" : "elephant"}
                >
                  {expense.isActive ? "사용 중" : "사용 중지"}
                </Badge>
              }
            />
          ))}
        </ul>
        {state.recurringExpenses
          .filter(({ isActive }) => isActive)
          .map((expense) => (
            <div
              key={`${expense.id}-definition-actions`}
              style={{ display: "flex", gap: 8 }}
            >
              <Button
                size="small"
                variant="weak"
                onClick={() => setEditor({ kind: "definition", expense })}
              >
                {expense.name} 반복 수정
              </Button>
              <Button
                size="small"
                variant="weak"
                onClick={() =>
                  void mutate((current) =>
                    deactivateRecurringExpense(current, expense.id),
                  )
                }
              >
                {expense.name} 반복 중지
              </Button>
            </div>
          ))}
        <Button
          variant="weak"
          display="block"
          style={{ marginTop: 12 }}
          onClick={() => setEditor({ kind: "add-definition" })}
        >
          고정지출 추가
        </Button>
      </section>

      {editor.kind === "definition" || editor.kind === "add-definition" ? (
        <ExpenseEditor
          initial={
            editor.kind === "definition"
              ? {
                  name: editor.expense.name,
                  amount: editor.expense.estimatedAmount,
                  dueDay: editor.expense.dueDay,
                }
              : { name: "", amount: 0, dueDay: 1 }
          }
          includeDueDay
          submitLabel={
            editor.kind === "definition" ? "반복 설정 저장" : "고정지출 저장"
          }
          isSaving={isSaving}
          onCancel={() => setEditor({ kind: "none" })}
          onSubmit={saveDefinition}
        />
      ) : null}
    </PageScaffold>
  );
}
