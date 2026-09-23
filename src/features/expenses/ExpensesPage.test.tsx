import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AppStoreProvider } from "../../app/app-store";
import {
  makeOccurrence,
  makeState,
  makeStateWithPendingExpense,
} from "../../domain/fixtures";
import type { DomainServices, SafeSpendStateV2 } from "../../domain/model";
import type { StateRepository } from "../../storage/state-repository";
import { ExpensesPage } from "./ExpensesPage";

function renderExpenses(
  state: SafeSpendStateV2,
  save = vi.fn().mockResolvedValue(undefined),
) {
  const repository: StateRepository = {
    load: vi.fn().mockResolvedValue({ kind: "ready", state }),
    save,
    clear: vi.fn().mockResolvedValue(undefined),
  };
  const domainServices: DomainServices = {
    createId: () => "new-occurrence",
    now: () => "2026-09-22T00:00:00.000Z",
  };

  render(
    <TDSMobileAITProvider brandPrimaryColor="#3182F6">
      <AppStoreProvider repository={repository}>
        <MemoryRouter>
          <ExpensesPage today="2026-09-22" domainServices={domainServices} />
        </MemoryRouter>
      </AppStoreProvider>
    </TDSMobileAITProvider>,
  );

  return { repository, user: userEvent.setup() };
}

describe("ExpensesPage", () => {
  it("explains when the current cycle has no expense occurrences", async () => {
    renderExpenses(makeState());

    expect(
      await screen.findByText("예정된 고정지출이 없어요."),
    ).toBeInTheDocument();
  });

  it("orders pending expenses by date before completed entries", async () => {
    renderExpenses(
      makeState({
        occurrences: [
          makeOccurrence({
            id: "rent",
            name: "월세",
            dueDate: "2026-09-10",
            status: "paid",
          }),
          makeOccurrence({
            id: "subscription",
            name: "구독료",
            dueDate: "2026-09-28",
          }),
          makeOccurrence({
            id: "insurance",
            name: "보험료",
            dueDate: "2026-09-25",
          }),
        ],
      }),
    );

    const rows = await screen.findAllByTestId("expense-row");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("보험료"),
      expect.stringContaining("구독료"),
      expect.stringContaining("월세"),
    ]);
  });

  it("uses the estimate as the default actual amount", async () => {
    const { user } = renderExpenses(makeStateWithPendingExpense(250_000));
    await screen.findByText("보험료");

    await user.click(screen.getByRole("button", { name: "보험료 납부 처리" }));

    expect(screen.getByLabelText("실제 출금액")).toHaveValue("250,000");
  });

  it("keeps full action names accessible without repeating them visually", async () => {
    renderExpenses(makeStateWithPendingExpense(250_000));
    await screen.findByText("보험료");

    const payment = screen.getByRole("button", {
      name: "보험료 납부 처리",
    });
    const skip = screen.getByRole("button", { name: "보험료 건너뛰기" });
    const postpone = screen.getByRole("button", { name: "보험료 미루기" });
    const edit = screen.getByRole("button", {
      name: "보험료 이번 일정 수정",
    });

    expect(payment).toHaveTextContent("납부 처리");
    expect(payment).not.toHaveTextContent("보험료");
    expect(skip).toHaveTextContent("건너뛰기");
    expect(postpone).toHaveTextContent("미루기");
    expect(edit).toHaveTextContent("일정 수정");
  });

  it("postpones a pending occurrence to the selected date", async () => {
    const { repository, user } = renderExpenses(
      makeStateWithPendingExpense(250_000),
    );
    await screen.findByText("보험료");

    await user.click(screen.getByRole("button", { name: "보험료 미루기" }));
    const dueDate = screen.getByLabelText("새 예정일");
    expect(dueDate).toHaveValue("2026-09-25");
    expect(dueDate).toHaveAttribute("min", "2026-09-26");
    await user.clear(dueDate);
    await user.type(dueDate, "2026-10-02");
    await user.click(screen.getByRole("button", { name: "이 날짜로 미루기" }));

    expect(repository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        occurrences: [expect.objectContaining({ dueDate: "2026-10-02" })],
      }),
    );
  });

  it("keeps the postpone editor open for a non-later date", async () => {
    const { repository, user } = renderExpenses(
      makeStateWithPendingExpense(250_000),
    );
    await screen.findByText("보험료");

    await user.click(screen.getByRole("button", { name: "보험료 미루기" }));
    await user.click(screen.getByRole("button", { name: "이 날짜로 미루기" }));

    expect(
      screen.getByText("기존 예정일보다 뒤의 날짜를 선택해 주세요"),
    ).toBeInTheDocument();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("limits a recurring expense due day to two digits", async () => {
    const { user } = renderExpenses(makeState());
    await screen.findByText("반복 설정");
    await user.click(screen.getByRole("button", { name: "고정지출 추가" }));

    const dueDay = screen.getByLabelText("결제일");
    await user.clear(dueDay);
    await user.type(dueDay, "101010101010");

    expect(dueDay).toHaveValue("10");
  });

  it("keeps recurring action names accessible without repeating them visually", async () => {
    renderExpenses(
      makeState({
        recurringExpenses: [
          {
            id: "recurring-expense",
            name: "보험료",
            estimatedAmount: 250_000,
            dueDay: 25,
            isActive: true,
          },
        ],
      }),
    );

    const edit = await screen.findByRole("button", {
      name: "보험료 반복 수정",
    });
    const stop = screen.getByRole("button", { name: "보험료 반복 중지" });

    expect(edit).toHaveTextContent("수정");
    expect(edit).not.toHaveTextContent("보험료");
    expect(stop).toHaveTextContent("사용 중지");
  });

  it("creates a current-cycle occurrence when an edited due day enters the horizon", async () => {
    const { repository, user } = renderExpenses(
      makeState({
        currentBalance: 581_820,
        safetyReserve: 0,
        nextIncomeDate: "2026-09-29",
        recurringExpenses: [
          {
            id: "rent",
            name: "월세",
            estimatedAmount: 780_000,
            dueDay: 30,
            isActive: true,
          },
        ],
      }),
    );

    await user.click(
      await screen.findByRole("button", { name: "월세 반복 수정" }),
    );
    const dueDay = screen.getByLabelText("결제일");
    await user.clear(dueDay);
    await user.type(dueDay, "26");
    await user.click(screen.getByRole("button", { name: "반복 설정 저장" }));

    expect(repository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        occurrences: [
          expect.objectContaining({
            id: "new-occurrence",
            recurringExpenseId: "rent",
            name: "월세",
            dueDate: "2026-09-26",
            estimatedAmount: 780_000,
            status: "pending",
          }),
        ],
      }),
    );
  });

  it("keeps the payment editor open when the amount exceeds the balance", async () => {
    const { repository, user } = renderExpenses(
      makeState({
        currentBalance: 100_000,
        occurrences: [makeOccurrence({ estimatedAmount: 250_000 })],
      }),
    );
    await screen.findByText("보험료");
    await user.click(screen.getByRole("button", { name: "보험료 납부 처리" }));

    await user.click(screen.getByRole("button", { name: "납부 완료" }));

    expect(
      screen.getByText("현재 잔액보다 큰 금액은 납부할 수 없어요"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("실제 출금액")).toHaveValue("250,000");
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("disables repeated payment while saving", async () => {
    let resolveSave!: () => void;
    const savePromise = new Promise<void>((resolve) => {
      resolveSave = resolve;
    });
    const save = vi.fn(() => savePromise);
    const { user } = renderExpenses(makeStateWithPendingExpense(250_000), save);
    await screen.findByText("보험료");
    await user.click(screen.getByRole("button", { name: "보험료 납부 처리" }));

    await user.click(screen.getByRole("button", { name: "납부 완료" }));

    expect(screen.getByRole("button", { name: "납부 완료" })).toBeDisabled();
    resolveSave();
  });

  it("can skip and then revert a pending occurrence", async () => {
    const { repository, user } = renderExpenses(
      makeStateWithPendingExpense(250_000),
    );
    await screen.findByText("보험료");

    await user.click(screen.getByRole("button", { name: "보험료 건너뛰기" }));
    await user.click(
      await screen.findByRole("button", { name: "보험료 되돌리기" }),
    );

    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(repository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        occurrences: [expect.objectContaining({ status: "pending" })],
      }),
    );
  });

  it("edits only the selected pending occurrence", async () => {
    const { repository, user } = renderExpenses(
      makeStateWithPendingExpense(250_000),
    );
    await screen.findByText("보험료");
    await user.click(
      screen.getByRole("button", { name: "보험료 이번 일정 수정" }),
    );
    const name = screen.getByLabelText("고정지출 이름");
    await user.clear(name);
    await user.type(name, "새 보험료");

    await user.click(screen.getByRole("button", { name: "이번 일정 저장" }));

    expect(repository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        occurrences: [expect.objectContaining({ name: "새 보험료" })],
      }),
    );
  });

  it("keeps an inactive definition readable with its history", async () => {
    renderExpenses(
      makeState({
        recurringExpenses: [
          {
            id: "recurring-expense",
            name: "보험료",
            estimatedAmount: 250_000,
            dueDay: 25,
            isActive: false,
          },
        ],
        occurrences: [
          makeOccurrence({
            status: "paid",
            actualAmount: 250_000,
            name: "보험료",
          }),
        ],
      }),
    );

    expect(await screen.findByText("사용 중지")).toBeInTheDocument();
    expect(screen.getByText("납부 완료")).toBeInTheDocument();
  });
});
