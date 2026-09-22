import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { PropsWithChildren } from "react";
import { describe, expect, it, vi } from "vitest";

import { makeState } from "../domain/fixtures";
import type { LoadResult } from "../storage/schema";
import type { StateRepository } from "../storage/state-repository";
import { AppStoreProvider, useAppStore } from "./app-store";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function makeRepository(
  overrides: Partial<StateRepository> = {},
): StateRepository {
  return {
    load: vi.fn().mockResolvedValue({
      kind: "ready",
      state: makeState({ currentBalance: 500_000 }),
    } satisfies LoadResult),
    save: vi.fn().mockResolvedValue(undefined),
    clear: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function StoreProbe() {
  const store = useAppStore();

  return (
    <div>
      <span>{store.loadState}</span>
      <span>{store.state?.currentBalance}</span>
      {store.persistenceError === null ? null : (
        <span>{store.persistenceError}</span>
      )}
      <button
        type="button"
        onClick={() =>
          void store.mutate((current) => ({
            ...current,
            currentBalance: current.currentBalance - 20_000,
          }))
        }
      >
        record purchase
      </button>
      <button type="button" onClick={() => void store.retrySave()}>
        retry save
      </button>
      <button type="button" onClick={() => void store.resetAfterConfirmation()}>
        reset
      </button>
    </div>
  );
}

function renderStoreProbe(repository: StateRepository) {
  const Wrapper = ({ children }: PropsWithChildren) => (
    <AppStoreProvider
      repository={repository}
      now={() => "2026-09-22T12:00:00.000Z"}
    >
      {children}
    </AppStoreProvider>
  );

  return render(<StoreProbe />, { wrapper: Wrapper });
}

describe("AppStoreProvider", () => {
  it("ignores a second mutation while the first save is pending", async () => {
    const save = createDeferred<void>();
    const repository = makeRepository({ save: vi.fn(() => save.promise) });
    const user = userEvent.setup();
    renderStoreProbe(repository);
    await screen.findByText("500000");

    await user.click(screen.getByRole("button", { name: "record purchase" }));
    await user.click(screen.getByRole("button", { name: "record purchase" }));

    expect(repository.save).toHaveBeenCalledTimes(1);
    expect(screen.getByText("480000")).toBeInTheDocument();

    await act(async () => save.resolve());
  });

  it("keeps failed changes in memory and retries the same snapshot", async () => {
    const save = vi
      .fn<StateRepository["save"]>()
      .mockRejectedValueOnce(new Error("bridge offline"))
      .mockResolvedValue(undefined);
    const repository = makeRepository({ save });
    const user = userEvent.setup();
    renderStoreProbe(repository);
    await screen.findByText("500000");

    await user.click(screen.getByRole("button", { name: "record purchase" }));
    expect(await screen.findByText("저장하지 못했어요")).toBeInTheDocument();
    expect(screen.getByText("480000")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "retry save" }));

    expect(repository.save).toHaveBeenLastCalledWith(
      expect.objectContaining({
        currentBalance: 480_000,
        updatedAt: "2026-09-22T12:00:00.000Z",
      }),
    );
    expect(save.mock.calls[0]?.[0]).toEqual(save.mock.calls[1]?.[0]);
  });

  it("clears storage only through the explicit reset action", async () => {
    const repository = makeRepository();
    const user = userEvent.setup();
    renderStoreProbe(repository);
    await screen.findByText("500000");

    await user.click(screen.getByRole("button", { name: "reset" }));

    await waitFor(() => expect(repository.clear).toHaveBeenCalledTimes(1));
    expect(screen.getByText("empty")).toBeInTheDocument();
  });
});
