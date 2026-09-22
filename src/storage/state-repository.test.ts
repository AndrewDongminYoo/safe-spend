import { describe, expect, it, vi } from "vitest";

import { makeState } from "../domain/fixtures";
import { createStateRepository, type StoragePort } from "./state-repository";

function makePort(overrides: Partial<StoragePort> = {}): StoragePort {
  return {
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("createStateRepository", () => {
  it("loads empty storage from the exact state key", async () => {
    const port = makePort();

    await expect(createStateRepository(port).load()).resolves.toEqual({
      kind: "empty",
    });
    expect(port.getItem).toHaveBeenCalledWith("safe-spend:state");
  });

  it("parses stored state and retains corrupt raw input", async () => {
    const valid = JSON.stringify(makeState());
    const validRepository = createStateRepository(
      makePort({ getItem: vi.fn().mockResolvedValue(valid) }),
    );
    const corruptRepository = createStateRepository(
      makePort({ getItem: vi.fn().mockResolvedValue("not-json") }),
    );

    await expect(validRepository.load()).resolves.toMatchObject({
      kind: "ready",
    });
    await expect(corruptRepository.load()).resolves.toEqual({
      kind: "corrupt",
      raw: "not-json",
      reason: "invalid JSON",
    });
  });

  it("maps read exceptions to unavailable", async () => {
    const repository = createStateRepository(
      makePort({
        getItem: vi.fn().mockRejectedValue(new Error("bridge offline")),
      }),
    );

    await expect(repository.load()).resolves.toEqual({
      kind: "unavailable",
      reason: "bridge offline",
    });
  });

  it("serializes and clears using the exact state key", async () => {
    const port = makePort();
    const repository = createStateRepository(port);
    const state = makeState();

    await repository.save(state);
    await repository.clear();

    expect(port.setItem).toHaveBeenCalledWith(
      "safe-spend:state",
      JSON.stringify(state),
    );
    expect(port.removeItem).toHaveBeenCalledWith("safe-spend:state");
  });
});
