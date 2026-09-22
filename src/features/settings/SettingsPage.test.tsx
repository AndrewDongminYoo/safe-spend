import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AppStoreProvider } from "../../app/app-store";
import { makeState } from "../../domain/fixtures";
import type { DomainServices, SafeSpendStateV1 } from "../../domain/model";
import type { StateRepository } from "../../storage/state-repository";
import { SettingsPage } from "./SettingsPage";

function renderSettings(state: SafeSpendStateV1, today = "2026-09-22") {
  const repository: StateRepository = {
    load: vi.fn().mockResolvedValue({ kind: "ready", state }),
    save: vi.fn().mockResolvedValue(undefined),
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
          <SettingsPage today={today} domainServices={domainServices} />
        </MemoryRouter>
      </AppStoreProvider>
    </TDSMobileAITProvider>,
  );

  return { repository, user: userEvent.setup() };
}

describe("SettingsPage", () => {
  it("offers cycle renewal on the income date", async () => {
    renderSettings(makeState({ nextIncomeDate: "2026-09-22" }));

    expect(await screen.findByText("수입이 들어왔나요?")).toBeInTheDocument();
  });

  it("does not renew a passed cycle automatically", async () => {
    const { repository } = renderSettings(
      makeState({ nextIncomeDate: "2026-09-21" }),
    );

    expect(await screen.findByText("수입이 들어왔나요?")).toBeInTheDocument();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("renews only after balance and next date confirmation", async () => {
    const { repository, user } = renderSettings(
      makeState({ nextIncomeDate: "2026-09-21" }),
    );
    await screen.findByText("수입이 들어왔나요?");
    await user.click(screen.getByRole("button", { name: "수입이 들어왔어요" }));
    await user.type(screen.getByLabelText("현재 잔액"), "2,000,000");
    await user.type(screen.getByLabelText("다음 수입일"), "2026-10-21");

    await user.click(screen.getByRole("button", { name: "새 주기 시작하기" }));

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        currentBalance: 2_000_000,
        nextIncomeDate: "2026-10-21",
      }),
    );
  });

  it("updates balance, reserve, and income date through one validated transition", async () => {
    const { repository, user } = renderSettings(makeState());
    await screen.findByText("기준 금액과 날짜");
    await user.click(screen.getByRole("button", { name: "기준 금액 수정" }));
    const balance = screen.getByLabelText("현재 잔액");
    const reserve = screen.getByLabelText("안전 여유금");
    const incomeDate = screen.getByLabelText("다음 수입일");
    await user.clear(balance);
    await user.type(balance, "900,000");
    await user.clear(reserve);
    await user.type(reserve, "120,000");
    await user.clear(incomeDate);
    await user.type(incomeDate, "2026-10-05");

    await user.click(screen.getByRole("button", { name: "저장하기" }));

    expect(repository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentBalance: 900_000,
        safetyReserve: 120_000,
        nextIncomeDate: "2026-10-05",
      }),
    );
  });

  it("closes the settings editor without saving", async () => {
    const { repository, user } = renderSettings(makeState());
    await screen.findByText("기준 금액과 날짜");
    await user.click(screen.getByRole("button", { name: "기준 금액 수정" }));

    expect(
      screen.queryByRole("button", { name: "기준 금액 수정" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "수정 취소" }));

    expect(screen.queryByLabelText("기준 금액 수정")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "기준 금액 수정" }),
    ).toBeInTheDocument();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("requires confirmation before deleting local data", async () => {
    const { repository, user } = renderSettings(makeState());
    await screen.findByText("기준 금액과 날짜");

    await user.click(
      screen.getByRole("button", { name: "저장 데이터 초기화" }),
    );
    expect(repository.clear).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "초기화하기" }));

    expect(repository.clear).toHaveBeenCalledTimes(1);
  });

  it("separates the local data action from its description", async () => {
    renderSettings(makeState());

    const reset = await screen.findByRole("button", {
      name: "저장 데이터 초기화",
    });

    expect(reset.parentElement).toHaveStyle({ marginTop: "12px" });
  });

  it("restores balance when a spending record is deleted from settings", async () => {
    const { repository, user } = renderSettings(
      makeState({
        currentBalance: 480_000,
        spendingRecords: [
          {
            id: "lunch",
            amount: 20_000,
            memo: "점심",
            spentAt: "2026-09-22T00:00:00.000Z",
          },
        ],
      }),
    );
    await screen.findByText("점심");
    await user.click(screen.getByRole("button", { name: "점심 지출 삭제" }));
    await user.click(screen.getByRole("button", { name: "삭제하기" }));

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ currentBalance: 500_000 }),
    );
  });
});
