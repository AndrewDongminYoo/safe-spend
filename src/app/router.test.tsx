import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { RouterProvider } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { makeState } from "../domain/fixtures";
import type { LoadResult } from "../storage/schema";
import type { StateRepository } from "../storage/state-repository";
import { AppStoreProvider } from "./app-store";
import { createAppRouter } from "./router";

function makeRepository(
  result: LoadResult | Promise<LoadResult>,
): StateRepository {
  return {
    load: vi.fn().mockImplementation(() => Promise.resolve(result)),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

function renderAppAt(repository: StateRepository) {
  render(
    <TDSMobileAITProvider brandPrimaryColor="#3182F6">
      <AppStoreProvider
        repository={repository}
        now={() => "2026-09-22T00:00:00.000Z"}
      >
        <RouterProvider router={createAppRouter(["/"])} />
      </AppStoreProvider>
    </TDSMobileAITProvider>,
  );
}

describe("startup routing", () => {
  it("renders the loading state", () => {
    renderAppAt(makeRepository(new Promise<LoadResult>(() => undefined)));
    expect(screen.getByText("불러오고 있어요")).toBeInTheDocument();
  });

  it.each([
    [{ kind: "empty" } as const, "계좌 연결 없이 시작해요"],
    [
      { kind: "corrupt", raw: "broken", reason: "invalid JSON" } as const,
      "저장된 데이터를 읽지 못했어요",
    ],
    [
      { kind: "unavailable", reason: "bridge offline" } as const,
      "저장소에 연결하지 못했어요",
    ],
  ])("renders $expectedText", async (loadResult, expectedText) => {
    renderAppAt(makeRepository(loadResult));
    expect(await screen.findByText(expectedText)).toBeInTheDocument();
  });

  it("renders the home route for a ready snapshot", async () => {
    renderAppAt(makeRepository({ kind: "ready", state: makeState() }));
    expect(
      await screen.findByText("다음 수입일까지 써도 되는 돈"),
    ).toBeInTheDocument();
  });

  it("does not clear corrupt data before explicit confirmation", async () => {
    const repository = makeRepository({
      kind: "corrupt",
      raw: "broken",
      reason: "invalid JSON",
    });
    const user = userEvent.setup();
    renderAppAt(repository);
    await screen.findByText("저장된 데이터를 읽지 못했어요");

    expect(repository.clear).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole("button", { name: "저장 데이터 초기화" }),
    );
    expect(repository.clear).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "초기화하기" }));

    expect(repository.clear).toHaveBeenCalledTimes(1);
  });
});
