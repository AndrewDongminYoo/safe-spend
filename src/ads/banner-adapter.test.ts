import { beforeEach, expect, it, vi } from "vitest";

import {
  ensureBannerInitialized,
  resetBannerInitializationForTests,
  type BannerAdsPort,
} from "./banner-adapter";

function makePort(initialize: BannerAdsPort["initialize"]): BannerAdsPort {
  return {
    isVersionSupported: () => true,
    isInitializeSupported: () => true,
    initialize,
    isAttachSupported: () => true,
    attach: () => ({ destroy: vi.fn() }),
  };
}

beforeEach(() => resetBannerInitializationForTests());

it("coordinates one initialization for multiple subscribers", () => {
  const initialize = vi.fn(({ onInitialized }) => onInitialized());
  const port = makePort(initialize);
  const first = vi.fn();
  const second = vi.fn();

  ensureBannerInitialized(port, first);
  ensureBannerInitialized(port, second);

  expect(initialize).toHaveBeenCalledTimes(1);
  expect(first).toHaveBeenCalledWith(true);
  expect(second).toHaveBeenCalledWith(true);
});
