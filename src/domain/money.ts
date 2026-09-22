import type { Won } from "./types";

export function assertWon(value: number): Won {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Won must be a safe non-negative integer");
  }

  return value;
}

export function parseWonInput(value: string): Won {
  const normalized = value.trim().replace(/,/g, "");

  if (!/^\d+$/.test(normalized)) {
    throw new Error("Enter a whole won amount");
  }

  return assertWon(Number(normalized));
}

export function formatWon(value: Won): string {
  return new Intl.NumberFormat("ko-KR").format(assertWon(value));
}
