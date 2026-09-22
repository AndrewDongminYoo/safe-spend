import { expect, it } from "vitest";

import { trackProductEvent, type ProductEvent } from "./product-events";

it("accepts only coarse non-financial product events", () => {
  expect(() =>
    trackProductEvent({
      name: "purchase_previewed",
      properties: { result: "within_safe_amount" },
    }),
  ).not.toThrow();

  const invalidAmount: Extract<ProductEvent, { name: "purchase_recorded" }> = {
    name: "purchase_recorded",
    properties: {
      result: "within_safe_amount",
      // @ts-expect-error Financial amounts are forbidden analytics properties.
      amount: 10_000,
    },
  };
  const invalidMemo: Extract<ProductEvent, { name: "purchase_recorded" }> = {
    name: "purchase_recorded",
    properties: {
      result: "within_safe_amount",
      // @ts-expect-error Purchase memos are forbidden analytics properties.
      memo: "점심",
    },
  };
  const invalidDate: Extract<ProductEvent, { name: "cycle_renewed" }> = {
    name: "cycle_renewed",
    properties: {
      // @ts-expect-error Exact dates are forbidden analytics properties.
      date: "2026-09-22",
    },
  };

  trackProductEvent(invalidAmount);
  trackProductEvent(invalidMemo);
  trackProductEvent(invalidDate);
});
