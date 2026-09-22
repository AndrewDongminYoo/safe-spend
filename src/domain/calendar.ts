import type { LocalDate } from "./types";

const DAY_IN_MILLISECONDS = 86_400_000;
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type DateParts = {
  year: number;
  month: number;
  day: number;
  epochDay: number;
};

function parseLocalDate(value: LocalDate): DateParts {
  const match = LOCAL_DATE_PATTERN.exec(value);

  if (match === null) {
    throw new Error(`${value} is not a valid local date`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const timestamp = Date.UTC(year, month - 1, day);
  const date = new Date(timestamp);

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`${value} is not a valid local date`);
  }

  return { year, month, day, epochDay: timestamp / DAY_IN_MILLISECONDS };
}

function assertDueDay(dueDay: number): void {
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31) {
    throw new Error("Due day must be an integer between 1 and 31");
  }
}

function formatLocalDate(year: number, month: number, day: number): LocalDate {
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function compareLocalDates(left: LocalDate, right: LocalDate): number {
  const difference =
    parseLocalDate(left).epochDay - parseLocalDate(right).epochDay;
  return Math.sign(difference);
}

export function calendarDaysBetween(start: LocalDate, end: LocalDate): number {
  return parseLocalDate(end).epochDay - parseLocalDate(start).epochDay;
}

export function resolveMonthlyDueDate(
  monthDate: LocalDate,
  dueDay: number,
): LocalDate {
  const { year, month } = parseLocalDate(monthDate);
  assertDueDay(dueDay);

  return formatLocalDate(
    year,
    month,
    Math.min(dueDay, daysInMonth(year, month)),
  );
}

export function listMonthlyDueDates(
  start: LocalDate,
  endInclusive: LocalDate,
  dueDay: number,
): LocalDate[] {
  const startParts = parseLocalDate(start);
  const endParts = parseLocalDate(endInclusive);
  assertDueDay(dueDay);

  if (startParts.epochDay > endParts.epochDay) {
    return [];
  }

  const dates: LocalDate[] = [];
  let year = startParts.year;
  let month = startParts.month;

  while (
    year < endParts.year ||
    (year === endParts.year && month <= endParts.month)
  ) {
    const monthDate = formatLocalDate(year, month, 1);
    const resolved = resolveMonthlyDueDate(monthDate, dueDay);

    if (
      compareLocalDates(resolved, start) >= 0 &&
      compareLocalDates(resolved, endInclusive) <= 0
    ) {
      dates.push(resolved);
    }

    if (month === 12) {
      year += 1;
      month = 1;
    } else {
      month += 1;
    }
  }

  return dates;
}
