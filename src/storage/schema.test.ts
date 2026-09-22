import { describe, expect, it } from "vitest";

import { makeOccurrence, makeState } from "../domain/fixtures";
import { parseStateSnapshot } from "./schema";

describe("parseStateSnapshot", () => {
  it("accepts a valid version 1 snapshot", () => {
    expect(parseStateSnapshot(JSON.stringify(makeState())).kind).toBe("ready");
  });

  it.each([
    ["not-json", "invalid JSON"],
    [JSON.stringify({ version: 2 }), "unsupported version"],
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
