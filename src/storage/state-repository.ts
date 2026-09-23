import { Storage } from "@apps-in-toss/web-framework";

import type { SafeSpendStateV2 } from "../domain/model";
import { parseStateSnapshot, type LoadResult } from "./schema";

const STATE_KEY = "safe-spend:state";

export interface StoragePort {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface StateRepository {
  load(): Promise<LoadResult>;
  save(state: SafeSpendStateV2): Promise<void>;
  clear(): Promise<void>;
}

function errorReason(error: unknown): string {
  return error instanceof Error ? error.message : "Storage is unavailable";
}

export function createStateRepository(port: StoragePort): StateRepository {
  return {
    async load() {
      try {
        const raw = await port.getItem(STATE_KEY);
        return raw === null ? { kind: "empty" } : parseStateSnapshot(raw);
      } catch (error) {
        return { kind: "unavailable", reason: errorReason(error) };
      }
    },
    async save(state) {
      await port.setItem(STATE_KEY, JSON.stringify(state));
    },
    async clear() {
      await port.removeItem(STATE_KEY);
    },
  };
}

export const appsInTossStateRepository = createStateRepository(Storage);
