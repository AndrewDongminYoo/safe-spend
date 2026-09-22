import { render, screen } from "@testing-library/react";
import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { describe, expect, it, vi } from "vitest";

import type { StateRepository } from "./storage/state-repository";
import App from "./App";

describe("App", () => {
  it("starts onboarding when local storage is empty", async () => {
    const repository: StateRepository = {
      load: vi.fn().mockResolvedValue({ kind: "empty" }),
      save: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    render(
      <TDSMobileAITProvider brandPrimaryColor="#3182F6">
        <App repository={repository} now={() => "2026-09-22T00:00:00.000Z"} />
      </TDSMobileAITProvider>,
    );

    expect(
      await screen.findByText("계좌 연결 없이 시작해요"),
    ).toBeInTheDocument();
  });
});
