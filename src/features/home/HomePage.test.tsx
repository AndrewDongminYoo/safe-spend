import { render, screen } from "@testing-library/react";
import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { AppStoreProvider } from "../../app/app-store";
import { makeState, makeStateWithPendingExpense } from "../../domain/fixtures";
import type { SafeSpendStateV1 } from "../../domain/model";
import type { StateRepository } from "../../storage/state-repository";
import { HomePage } from "./HomePage";

function renderHome(state: SafeSpendStateV1) {
  const repository: StateRepository = {
    load: vi.fn().mockResolvedValue({ kind: "ready", state }),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };

  render(
    <TDSMobileAITProvider brandPrimaryColor="#3182F6">
      <AppStoreProvider repository={repository}>
        <MemoryRouter>
          <HomePage today="2026-09-22" />
        </MemoryRouter>
      </AppStoreProvider>
    </TDSMobileAITProvider>,
  );
}

describe("HomePage", () => {
  it("shows the safe amount, daily allowance, and protected breakdown", async () => {
    renderHome(makeStateWithPendingExpense(250_000));

    expect(
      await screen.findByRole("heading", { name: "650000원" }),
    ).toBeInTheDocument();
    expect(screen.getByText("650,000원")).toBeInTheDocument();
    expect(screen.getByText("하루 72,222원")).toBeInTheDocument();
    expect(screen.getByText("고정지출 250,000원")).toBeInTheDocument();
    expect(screen.getByText("안전 여유금 100,000원")).toBeInTheDocument();
  });

  it("uses text, not color alone, for a shortfall", async () => {
    renderHome(makeState({ currentBalance: 100_000, safetyReserve: 150_000 }));

    expect(
      await screen.findByRole("heading", { name: "50,000원이 부족해요" }),
    ).toBeInTheDocument();
  });
});
