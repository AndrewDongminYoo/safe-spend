import { Badge, Button, ListRow } from "@toss/tds-mobile";
import { useState } from "react";

import { trackProductEvent } from "../../analytics/product-events";
import { useAppStore } from "../../app/app-store";
import { PageScaffold } from "../../components/PageScaffold";
import { WonTextField } from "../../components/WonTextField";
import { compareLocalDates } from "../../domain/calendar";
import { formatWon, parseWonInput } from "../../domain/money";
import type { DomainServices } from "../../domain/model";
import { systemDomainServices } from "../../domain/services";
import {
  deleteSpendingRecord,
  renewCycle,
  updateCycleSettings,
} from "../../domain/transitions";
import { CycleRenewalSheet } from "./CycleRenewalSheet";

interface SettingsPageProps {
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

export function SettingsPage({
  today = getTodayInKorea(),
  domainServices = systemDomainServices,
}: SettingsPageProps) {
  const { state, mutate, isSaving, resetAfterConfirmation } = useAppStore();
  const [showRenewal, setShowRenewal] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [balanceInput, setBalanceInput] = useState("");
  const [reserveInput, setReserveInput] = useState("");
  const [incomeDateInput, setIncomeDateInput] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isResetConfirming, setIsResetConfirming] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);

  if (state === null) {
    return null;
  }

  const cyclePassed = compareLocalDates(state.nextIncomeDate, today) <= 0;

  const openEdit = () => {
    setBalanceInput(formatWon(state.currentBalance));
    setReserveInput(formatWon(state.safetyReserve));
    setIncomeDateInput(state.nextIncomeDate);
    setShowEdit(true);
  };

  const saveSettings = async () => {
    try {
      const input = {
        currentBalance: parseWonInput(balanceInput),
        safetyReserve: parseWonInput(reserveInput),
        nextIncomeDate: incomeDateInput,
      };
      compareLocalDates(input.nextIncomeDate, input.nextIncomeDate);
      setEditError(null);
      if (await mutate((current) => updateCycleSettings(current, input))) {
        setShowEdit(false);
      }
    } catch {
      setEditError("금액과 다음 수입일을 확인해 주세요");
    }
  };

  const renew = async (input: {
    currentBalance: number;
    nextIncomeDate: string;
  }) => {
    if (
      await mutate((current) =>
        renewCycle(
          current,
          {
            currentBalance: input.currentBalance,
            receivedOn: today,
            nextIncomeDate: input.nextIncomeDate,
          },
          domainServices,
        ),
      )
    ) {
      trackProductEvent({ name: "cycle_renewed", properties: {} });
      setShowRenewal(false);
    }
  };

  const recordPendingDeletion = state.spendingRecords.find(
    ({ id }) => id === recordToDelete,
  );

  return (
    <PageScaffold title="설정" subtitle="금액 기준과 로컬 데이터를 관리해요.">
      {cyclePassed ? (
        <section
          style={{
            padding: 16,
            borderRadius: 16,
            background: "#f2f4f6",
            marginBottom: 24,
          }}
        >
          <h2 style={{ marginTop: 0 }}>수입이 들어왔나요?</h2>
          <p>
            자동으로 새 주기를 시작하지 않아요. 입금 후 잔액을 확인해 주세요.
          </p>
          <Button display="block" onClick={() => setShowRenewal(true)}>
            수입이 들어왔어요
          </Button>
          {showRenewal ? (
            <CycleRenewalSheet
              today={today}
              isSaving={isSaving}
              onCancel={() => setShowRenewal(false)}
              onRenew={renew}
            />
          ) : null}
        </section>
      ) : null}

      <section aria-label="기준 금액과 날짜">
        <h2>기준 금액과 날짜</h2>
        <ul style={{ listStyle: "none", margin: "0 -24px", padding: 0 }}>
          <ListRow
            contents="현재 잔액"
            right={`${formatWon(state.currentBalance)}원`}
          />
          <ListRow
            contents="안전 여유금"
            right={`${formatWon(state.safetyReserve)}원`}
          />
          <ListRow contents="다음 수입일" right={state.nextIncomeDate} />
        </ul>
        {showEdit ? null : (
          <Button variant="weak" display="block" onClick={openEdit}>
            기준 금액 수정
          </Button>
        )}
      </section>

      {showEdit ? (
        <section
          aria-label="기준 금액 수정"
          style={{ display: "grid", gap: 12, marginTop: 16 }}
        >
          <WonTextField
            label="현재 잔액"
            value={balanceInput}
            onValueChange={setBalanceInput}
          />
          <WonTextField
            label="안전 여유금"
            value={reserveInput}
            onValueChange={setReserveInput}
          />
          <label style={{ display: "grid", gap: 8 }}>
            <span>다음 수입일</span>
            <input
              aria-label="다음 수입일"
              type="date"
              value={incomeDateInput}
              onChange={(event) =>
                setIncomeDateInput(event.currentTarget.value)
              }
              style={{ minHeight: 56, padding: "0 16px", font: "inherit" }}
            />
          </label>
          {editError === null ? null : <p role="alert">{editError}</p>}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <Button
              variant="weak"
              disabled={isSaving}
              onClick={() => {
                setEditError(null);
                setShowEdit(false);
              }}
            >
              수정 취소
            </Button>
            <Button disabled={isSaving} onClick={() => void saveSettings()}>
              저장하기
            </Button>
          </div>
        </section>
      ) : null}

      <section aria-label="반복 고정지출" style={{ marginTop: 32 }}>
        <h2>반복 고정지출</h2>
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
      </section>

      <section aria-label="기록한 지출" style={{ marginTop: 32 }}>
        <h2>기록한 지출</h2>
        {state.spendingRecords.length === 0 ? (
          <p>기록한 지출이 없어요.</p>
        ) : (
          state.spendingRecords.map((record) => {
            const label = record.memo ?? "메모 없는 지출";
            return (
              <div key={record.id}>
                <ListRow
                  contents={label}
                  right={`${formatWon(record.amount)}원`}
                />
                <Button
                  size="small"
                  variant="weak"
                  onClick={() => setRecordToDelete(record.id)}
                >
                  {label} 지출 삭제
                </Button>
              </div>
            );
          })
        )}
        {recordPendingDeletion === undefined ? null : (
          <div role="alert" style={{ marginTop: 12 }}>
            <p>{recordPendingDeletion.memo ?? "이 지출"} 기록을 삭제할까요?</p>
            <Button
              color="danger"
              disabled={isSaving}
              onClick={() =>
                void mutate((current) =>
                  deleteSpendingRecord(current, recordPendingDeletion.id),
                ).then((saved) => {
                  if (saved) setRecordToDelete(null);
                })
              }
            >
              삭제하기
            </Button>
          </div>
        )}
      </section>

      <section aria-label="로컬 데이터" style={{ marginTop: 32 }}>
        <h2>로컬 데이터</h2>
        <p>토스 앱을 삭제하면 이 데이터도 함께 삭제돼요.</p>
        <div style={{ marginTop: 12 }}>
          {isResetConfirming ? (
            <Button
              color="danger"
              onClick={() => void resetAfterConfirmation()}
            >
              초기화하기
            </Button>
          ) : (
            <Button variant="weak" onClick={() => setIsResetConfirming(true)}>
              저장 데이터 초기화
            </Button>
          )}
        </div>
      </section>
    </PageScaffold>
  );
}
