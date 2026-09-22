import type { DomainServices } from "./model";

export const systemDomainServices: DomainServices = {
  createId: () => crypto.randomUUID(),
  now: () => new Date().toISOString(),
};
