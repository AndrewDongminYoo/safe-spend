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
  postponePendingOccurrence,
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
  | { kind: "postpone"; occurrence: ExpenseOccurrence }
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

function getNextLocalDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
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
  const [postponeDate, setPostponeDate] = useState("");
  const [postponeError, setPostponeError] = useState<string | null>(null);

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

  const openPostpone = (occurrence: ExpenseOccurrence) => {
    setPostponeDate(occurrence.dueDate);
    setPostponeError(null);
    setEditor({ kind: "postpone", occurrence });
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

  const postpone = async () => {
    if (editor.kind !== "postpone") {
      return;
    }

    try {
      setPostponeError(null);
      if (
        await mutate((current) =>
          postponePendingOccurrence(
            current,
            editor.occurrence.id,
            postponeDate,
          ),
        )
      ) {
        setEditor({ kind: "none" });
      }
    } catch {
      setPostponeError("기존 예정일보다 뒤의 날짜를 선택해 주세요");
    }
  };

  const saveDefinition = async (value: ExpenseEditorValue) => {
    if (value.dueDay === undefined) {
      return;
    }

    const saved = await mutate((current) =>
      editor.kind === "definition"
        ? updateRecurringExpense(
            current,
            editor.expense.id,
            {
              name: value.name,
              estimatedAmount: value.amount,
              dueDay: value.dueDay!,
              today,
            },
            domainServices,
          )
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
      subtitle="예정된 지출과 납부하거나 건너뛴 내역을 확인해요."
    >
      <section aria-label="고정지출 내역">
        {occurrences.length === 0 ? (
          <p style={{ margin: "8px 0 0", color: "#6b7684" }}>
            예정된 고정지출이 없어요.
          </p>
        ) : (
          occurrences.map((occurrence) => (
            <div key={occurrence.id} style={{ margin: "0 -24px 12px" }}>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                <ListRow
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
              </ul>
              <div
                aria-label={`${occurrence.name} 관리`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 8,
                  padding: "0 24px 12px",
                }}
              >
                {occurrence.status === "pending" ? (
                  <>
                    <Button
                      aria-label={`${occurrence.name} 납부 처리`}
                      variant="weak"
                      disabled={isSaving}
                      style={{ gridColumn: "1 / -1" }}
                      onClick={() => openPayment(occurrence)}
                    >
                      납부 처리
                    </Button>
                    <Button
                      aria-label={`${occurrence.name} 건너뛰기`}
                      size="small"
                      variant="weak"
                      disabled={isSaving}
                      onClick={() =>
                        void mutate((current) =>
                          markOccurrenceSkipped(current, occurrence.id),
                        )
                      }
                    >
                      건너뛰기
                    </Button>
                    <Button
                      aria-label={`${occurrence.name} 미루기`}
                      size="small"
                      variant="weak"
                      disabled={isSaving}
                      onClick={() => openPostpone(occurrence)}
                    >
                      미루기
                    </Button>
                    <Button
                      aria-label={`${occurrence.name} 이번 일정 수정`}
                      size="small"
                      variant="weak"
                      disabled={isSaving}
                      onClick={() =>
                        setEditor({ kind: "occurrence", occurrence })
                      }
                    >
                      일정 수정
                    </Button>
                  </>
                ) : (
                  <Button
                    aria-label={`${occurrence.name} 되돌리기`}
                    variant="weak"
                    display="block"
                    disabled={isSaving}
                    style={{ gridColumn: "1 / -1" }}
                    onClick={() =>
                      void mutate((current) =>
                        revertOccurrence(current, occurrence.id),
                      )
                    }
                  >
                    되돌리기
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
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

      {editor.kind === "postpone" ? (
        <section
          aria-label={`${editor.occurrence.name} 미루기`}
          style={{ display: "grid", gap: 12, margin: "24px 0" }}
        >
          <h2 style={{ margin: 0 }}>{editor.occurrence.name} 미루기</h2>
          <label style={{ display: "grid", gap: 8 }}>
            <span>새 예정일</span>
            <input
              aria-label="새 예정일"
              type="date"
              min={getNextLocalDate(editor.occurrence.dueDate)}
              value={postponeDate}
              onChange={(event) => {
                setPostponeDate(event.currentTarget.value);
                setPostponeError(null);
              }}
              style={{ minHeight: 56, padding: "0 16px", font: "inherit" }}
            />
          </label>
          {postponeError === null ? null : (
            <p role="alert" style={{ margin: 0 }}>
              {postponeError}
            </p>
          )}
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
            <Button disabled={isSaving} onClick={() => void postpone()}>
              이 날짜로 미루기
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
        <div style={{ margin: "0 -24px" }}>
          {state.recurringExpenses.map((expense) => (
            <div key={expense.id} style={{ marginBottom: 12 }}>
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                <ListRow
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
              </ul>
              {expense.isActive ? (
                <div
                  aria-label={`${expense.name} 반복 관리`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    padding: "0 24px 12px",
                  }}
                >
                  <Button
                    aria-label={`${expense.name} 반복 수정`}
                    size="small"
                    variant="weak"
                    onClick={() => setEditor({ kind: "definition", expense })}
                  >
                    수정
                  </Button>
                  <Button
                    aria-label={`${expense.name} 반복 중지`}
                    size="small"
                    variant="weak"
                    onClick={() =>
                      void mutate((current) =>
                        deactivateRecurringExpense(current, expense.id),
                      )
                    }
                  >
                    사용 중지
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
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
