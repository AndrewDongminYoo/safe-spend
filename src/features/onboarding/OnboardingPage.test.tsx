import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AppStoreProvider } from "../../app/app-store";
import type { DomainServices } from "../../domain/model";
import type { StateRepository } from "../../storage/state-repository";
import { OnboardingPage } from "./OnboardingPage";

function renderOnboarding(today = "2026-09-22") {
  let id = 0;
  const services: DomainServices = {
    createId: () => `id-${++id}`,
    now: () => "2026-09-22T00:00:00.000Z",
  };
  const repository: StateRepository = {
    load: vi.fn().mockResolvedValue({ kind: "empty" }),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };

  render(
    <TDSMobileAITProvider brandPrimaryColor="#3182F6">
      <AppStoreProvider repository={repository} now={services.now}>
        <MemoryRouter>
          <OnboardingPage today={today} domainServices={services} />
        </MemoryRouter>
      </AppStoreProvider>
    </TDSMobileAITProvider>,
  );

  return { repository, user: userEvent.setup() };
}

async function enterCycleBasics(
  user: ReturnType<typeof userEvent.setup>,
  values = {
    balance: "1,000,000",
    incomeDate: "2026-10-01",
    reserve: "100,000",
  },
) {
  await user.type(screen.getByLabelText("현재 잔액"), values.balance);
  await user.click(screen.getByRole("button", { name: "다음" }));
  await user.type(screen.getByLabelText("다음 수입일"), values.incomeDate);
  await user.click(screen.getByRole("button", { name: "다음" }));
  await user.type(screen.getByLabelText("안전 여유금"), values.reserve);
  await user.click(screen.getByRole("button", { name: "다음" }));
}

describe("OnboardingPage", () => {
  it("defaults an untouched safety reserve to zero", async () => {
    const { repository, user } = renderOnboarding();
    await user.type(screen.getByLabelText("현재 잔액"), "1,000,000");
    await user.click(screen.getByRole("button", { name: "다음" }));
    await user.type(screen.getByLabelText("다음 수입일"), "2026-10-01");
    await user.click(screen.getByRole("button", { name: "다음" }));
    await user.click(screen.getByRole("button", { name: "다음" }));
    await user.click(screen.getByRole("button", { name: "계산 결과 보기" }));

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ safetyReserve: 0 }),
    );
  });

  it("creates a cycle without requiring a recurring expense", async () => {
    const { repository, user } = renderOnboarding();
    await enterCycleBasics(user);

    await user.click(screen.getByRole("button", { name: "계산 결과 보기" }));

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        currentBalance: 1_000_000,
        safetyReserve: 100_000,
        nextIncomeDate: "2026-10-01",
        recurringExpenses: [],
      }),
    );
  });

  it.each(["-1", "12.5", "9007199254740992"])(
    "rejects invalid balance %s",
    async (value) => {
      const { user } = renderOnboarding();

      await user.type(screen.getByLabelText("현재 잔액"), value);

      expect(
        screen.getByText("0 이상의 정수 금액을 입력해 주세요"),
      ).toBeInTheDocument();
    },
  );

  it("creates a clamped pending occurrence for due day 31", async () => {
    const { repository, user } = renderOnboarding("2026-02-01");
    await enterCycleBasics(user, {
      balance: "1,000,000",
      incomeDate: "2026-02-28",
      reserve: "0",
    });
    await user.type(screen.getByLabelText("고정지출 이름"), "보험료");
    await user.type(screen.getByLabelText("예정 금액"), "250,000");
    await user.type(screen.getByLabelText("결제일"), "31");
    await user.click(screen.getByRole("button", { name: "고정지출 추가" }));

    await user.click(screen.getByRole("button", { name: "계산 결과 보기" }));

    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        occurrences: [expect.objectContaining({ dueDate: "2026-02-28" })],
      }),
    );
  });

  it("limits a recurring expense due day to two digits", async () => {
    const { user } = renderOnboarding();
    await enterCycleBasics(user);

    const dueDay = screen.getByLabelText("결제일");
    await user.type(dueDay, "101010101010");

    expect(dueDay).toHaveValue("10");
  });
});
