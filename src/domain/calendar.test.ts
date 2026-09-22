import { describe, expect, it } from "vitest";

import {
  calendarDaysBetween,
  compareLocalDates,
  listMonthlyDueDates,
  resolveMonthlyDueDate,
} from "./calendar";

describe("calendarDaysBetween", () => {
  it("counts calendar days without elapsed-hour drift", () => {
    expect(calendarDaysBetween("2026-03-07", "2026-03-09")).toBe(2);
  });

  it("returns zero for the same day and a signed result in reverse", () => {
    expect(calendarDaysBetween("2026-09-22", "2026-09-22")).toBe(0);
    expect(calendarDaysBetween("2026-09-23", "2026-09-22")).toBe(-1);
  });
});

describe("compareLocalDates", () => {
  it("orders date-only values", () => {
    expect(compareLocalDates("2026-09-21", "2026-09-22")).toBeLessThan(0);
    expect(compareLocalDates("2026-09-22", "2026-09-22")).toBe(0);
    expect(compareLocalDates("2026-09-23", "2026-09-22")).toBeGreaterThan(0);
  });

  it.each(["2026-02-29", "2026-2-01", "not-a-date"])(
    "rejects invalid date %s",
    (value) => {
      expect(() => compareLocalDates(value, "2026-09-22")).toThrow(
        "valid local date",
      );
    },
  );
});

describe("resolveMonthlyDueDate", () => {
  it.each([
    ["2026-02-01", 31, "2026-02-28"],
    ["2028-02-01", 31, "2028-02-29"],
    ["2026-04-01", 31, "2026-04-30"],
  ] as const)("clamps %s day %s to %s", (monthDate, dueDay, expected) => {
    expect(resolveMonthlyDueDate(monthDate, dueDay)).toBe(expected);
  });

  it.each([0, 32, 1.5])("rejects invalid due day %s", (dueDay) => {
    expect(() => resolveMonthlyDueDate("2026-09-22", dueDay)).toThrow(
      "between 1 and 31",
    );
  });
});

describe("listMonthlyDueDates", () => {
  it("lists every due date inside an inclusive horizon", () => {
    expect(listMonthlyDueDates("2026-09-22", "2026-11-25", 25)).toEqual([
      "2026-09-25",
      "2026-10-25",
      "2026-11-25",
    ]);
  });

  it("excludes resolved dates outside the horizon", () => {
    expect(listMonthlyDueDates("2026-02-28", "2026-04-29", 31)).toEqual([
      "2026-02-28",
      "2026-03-31",
    ]);
  });

  it("returns no dates for a reversed horizon", () => {
    expect(listMonthlyDueDates("2026-10-01", "2026-09-30", 1)).toEqual([]);
  });
});
