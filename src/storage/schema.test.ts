import { describe, expect, it } from "vitest";

import { makeOccurrence, makeState } from "../domain/fixtures";
import { parseStateSnapshot } from "./schema";

describe("parseStateSnapshot", () => {
  it("migrates valid version 1 deductions as non-refundable history", () => {
    const legacyState = {
      ...makeState(),
      version: 1,
      balanceRevision: undefined,
      occurrences: [makeOccurrence({ status: "paid", actualAmount: 200_000 })],
      spendingRecords: [
        {
          id: "legacy-record",
          amount: 20_000,
          spentAt: "2026-09-21T00:00:00.000Z",
        },
      ],
    };
    const result = parseStateSnapshot(JSON.stringify(legacyState));

    expect(result).toMatchObject({
      kind: "ready",
      state: {
        version: 2,
        balanceRevision: 1,
        occurrences: [{ balanceRevision: 0 }],
        spendingRecords: [{ balanceRevision: 0 }],
      },
    });
  });

  it("rejects a snapshot whose protected amount aggregate is unsafe", () => {
    const raw = JSON.stringify(
      makeState({
        safetyReserve: Number.MAX_SAFE_INTEGER,
        occurrences: [
          makeOccurrence({ estimatedAmount: Number.MAX_SAFE_INTEGER }),
        ],
      }),
    );

    expect(parseStateSnapshot(raw)).toMatchObject({
      kind: "corrupt",
      raw,
      reason: expect.stringContaining("Protected amount"),
    });
  });

  it("rejects a spending record from a future balance revision", () => {
    const raw = JSON.stringify(
      makeState({
        balanceRevision: 0,
        spendingRecords: [
          {
            id: "future-record",
            amount: 100,
            spentAt: "2026-09-22T00:00:00.000Z",
            balanceRevision: 1,
          },
        ],
      }),
    );

    expect(parseStateSnapshot(raw)).toMatchObject({
      kind: "corrupt",
      raw,
      reason: expect.stringContaining(
        "spendingRecords[0].balanceRevision cannot exceed balanceRevision",
      ),
    });
  });

  it("rejects a paid occurrence from a future balance revision", () => {
    const raw = JSON.stringify(
      makeState({
        balanceRevision: 0,
        occurrences: [
          makeOccurrence({
            status: "paid",
            actualAmount: 100,
            balanceRevision: 1,
          }),
        ],
      }),
    );

    expect(parseStateSnapshot(raw)).toMatchObject({
      kind: "corrupt",
      raw,
      reason: expect.stringContaining(
        "occurrences[0].balanceRevision cannot exceed balanceRevision",
      ),
    });
  });

  it.each([
    ["not-json", "invalid JSON"],
    [JSON.stringify({ version: 3 }), "unsupported version"],
    [JSON.stringify({ ...makeState(), currentBalance: 1.5 }), "currentBalance"],
    [
      JSON.stringify({ ...makeState(), nextIncomeDate: "2026-02-30" }),
      "nextIncomeDate",
    ],
    [
      JSON.stringify({
        ...makeState(),
        recurringExpenses: [
          {
            id: "id",
            name: "보험료",
            estimatedAmount: 100,
            dueDay: 32,
            isActive: true,
          },
        ],
      }),
      "dueDay",
    ],
    [
      JSON.stringify({
        ...makeState(),
        occurrences: [makeOccurrence({ status: "unknown" as "pending" })],
      }),
      "status",
    ],
    [
      JSON.stringify({
        ...makeState(),
        spendingRecords: [
          { id: "id", amount: -1, spentAt: "2026-09-22T00:00:00.000Z" },
        ],
      }),
      "amount",
    ],
  ])("retains corrupt raw input: %s", (raw, reason) => {
    expect(parseStateSnapshot(raw)).toMatchObject({
      kind: "corrupt",
      raw,
      reason: expect.stringContaining(reason),
    });
  });
});
