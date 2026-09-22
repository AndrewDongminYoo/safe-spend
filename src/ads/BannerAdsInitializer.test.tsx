import { render } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, expect, it, vi } from "vitest";

import {
  resetBannerInitializationForTests,
  type BannerAdsPort,
} from "./banner-adapter";
import { BannerAdsInitializer } from "./BannerAdsInitializer";

beforeEach(() => resetBannerInitializationForTests());

it("initializes supported banner ads once at application startup", () => {
  const initialize = vi.fn(({ onInitialized }) => onInitialized());
  const port: BannerAdsPort = {
    isVersionSupported: () => true,
    isInitializeSupported: () => true,
    initialize,
    isAttachSupported: () => true,
    attach: () => ({ destroy: vi.fn() }),
  };

  render(
    <StrictMode>
      <BannerAdsInitializer port={port} adGroupId="ait-ad-test-banner-id" />
    </StrictMode>,
  );

  expect(initialize).toHaveBeenCalledTimes(1);
});
