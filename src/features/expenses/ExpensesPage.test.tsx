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
import type { SafeSpendStateV1 } from "../../domain/model";
import type { StateRepository } from "../../storage/state-repository";
import { ExpensesPage } from "./ExpensesPage";

function renderExpenses(
  state: SafeSpendStateV1,
  save = vi.fn().mockResolvedValue(undefined),
) {
  const repository: StateRepository = {
    load: vi.fn().mockResolvedValue({ kind: "ready", state }),
    save,
    clear: vi.fn().mockResolvedValue(undefined),
  };

  render(
    <TDSMobileAITProvider brandPrimaryColor="#3182F6">
      <AppStoreProvider repository={repository}>
        <MemoryRouter>
          <ExpensesPage />
        </MemoryRouter>
      </AppStoreProvider>
    </TDSMobileAITProvider>,
  );

  return { repository, user: userEvent.setup() };
}

describe("ExpensesPage", () => {
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
