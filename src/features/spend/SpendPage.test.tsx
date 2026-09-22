import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AppStoreProvider } from "../../app/app-store";
import { makeState, makeStateWithPendingExpense } from "../../domain/fixtures";
import type { DomainServices, SafeSpendStateV1 } from "../../domain/model";
import type { StateRepository } from "../../storage/state-repository";
import { SpendPage } from "./SpendPage";

function renderSpend(state: SafeSpendStateV1) {
  const repository: StateRepository = {
    load: vi.fn().mockResolvedValue({ kind: "ready", state }),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
  const domainServices: DomainServices = {
    createId: () => "purchase-id",
    now: () => "2026-09-22T00:00:00.000Z",
  };

  render(
    <TDSMobileAITProvider brandPrimaryColor="#3182F6">
      <AppStoreProvider repository={repository}>
        <MemoryRouter>
          <SpendPage today="2026-09-22" domainServices={domainServices} />
        </MemoryRouter>
      </AppStoreProvider>
    </TDSMobileAITProvider>,
  );

  return { repository, user: userEvent.setup() };
}

describe("SpendPage", () => {
  it("keeps the amount and memo fields in one compact group", async () => {
    renderSpend(makeState());

    expect(await screen.findByRole("group", { name: "지출 정보" })).toHaveStyle(
      { gap: "0" },
    );
  });

  it("previews without mutating state", async () => {
    const { repository, user } = renderSpend(
      makeStateWithPendingExpense(250_000),
    );
    await screen.findByLabelText("지출 금액");

    await user.type(screen.getByLabelText("지출 금액"), "65,000");

    expect(screen.getByText("써도 되는 돈의 10.0%")).toBeInTheDocument();
    expect(screen.getByText("지출 후 585,000원")).toBeInTheDocument();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("records only after the explicit action", async () => {
    const { repository, user } = renderSpend(
      makeStateWithPendingExpense(250_000),
    );
    await screen.findByLabelText("지출 금액");
    await user.type(screen.getByLabelText("지출 금액"), "65,000");

    await user.click(screen.getByRole("button", { name: "지출로 기록하기" }));

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ currentBalance: 935_000 }),
    );
  });

  it("warns when a purchase exceeds the safe amount", async () => {
    const { user } = renderSpend(makeStateWithPendingExpense(250_000));
    await screen.findByLabelText("지출 금액");

    await user.type(screen.getByLabelText("지출 금액"), "700,000");

    expect(
      screen.getByText("써도 되는 돈보다 50,000원 많아요"),
    ).toBeInTheDocument();
  });

  it("does not record a purchase above the current balance", async () => {
    const { user } = renderSpend(
      makeState({ currentBalance: 50_000, safetyReserve: 0 }),
    );
    await screen.findByLabelText("지출 금액");

    await user.type(screen.getByLabelText("지출 금액"), "60,000");

    expect(
      screen.getByRole("button", { name: "지출로 기록하기" }),
    ).toBeDisabled();
    expect(
      screen.getByText("현재 잔액보다 큰 금액은 기록할 수 없어요"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("지출 영향")).toBeInTheDocument();
    expect(
      screen.getByText("써도 되는 돈보다 10,000원 많아요"),
    ).toBeInTheDocument();
  });

  it("explains that zero is not a valid purchase and hides the preview", async () => {
    const { user } = renderSpend(makeState());
    await screen.findByLabelText("지출 금액");

    await user.type(screen.getByLabelText("지출 금액"), "0");

    expect(
      screen.getByText("0원보다 큰 금액을 입력해 주세요"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("지출 영향")).not.toBeInTheDocument();
  });

  it("announces a valid preview as a polite live region", async () => {
    const { user } = renderSpend(makeState());
    await screen.findByLabelText("지출 금액");

    await user.type(screen.getByLabelText("지출 금액"), "10,000");

    expect(screen.getByLabelText("지출 영향")).toHaveAttribute(
      "aria-live",
      "polite",
    );
  });

  it("reports an unsupported preview range without crashing", async () => {
    const { user } = renderSpend(
      makeState({ currentBalance: 0, safetyReserve: Number.MAX_SAFE_INTEGER }),
    );
    await screen.findByLabelText("지출 금액");

    await user.type(screen.getByLabelText("지출 금액"), "1");

    expect(
      screen.getByText("계산할 수 있는 금액 범위를 넘었어요"),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("지출 영향")).not.toBeInTheDocument();
  });
});
