import { render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  resetBannerInitializationForTests,
  type BannerAdsPort,
} from "./banner-adapter";
import { HomeBanner } from "./HomeBanner";

function makePort(overrides: Partial<BannerAdsPort> = {}): BannerAdsPort {
  return {
    isVersionSupported: () => true,
    isInitializeSupported: () => true,
    initialize: ({ onInitialized }) => onInitialized(),
    isAttachSupported: () => true,
    attach: (_adGroupId, _target, callbacks) => {
      callbacks.onRendered();
      return { destroy: vi.fn() };
    },
    ...overrides,
  };
}

beforeEach(() => resetBannerInitializationForTests());

describe("HomeBanner", () => {
  it("renders no reserved space when banner APIs are unsupported", () => {
    render(
      <HomeBanner
        port={makePort({ isInitializeSupported: () => false })}
        adGroupId="ait-ad-test-banner-id"
      />,
    );

    expect(screen.queryByTestId("home-banner-slot")).not.toBeInTheDocument();
  });

  it("renders no reserved space below Toss 5.241.0", () => {
    render(
      <HomeBanner
        port={makePort({ isVersionSupported: () => false })}
        adGroupId="ait-ad-test-banner-id"
      />,
    );

    expect(screen.queryByTestId("home-banner-slot")).not.toBeInTheDocument();
  });

  it("destroys an attached banner on unmount", () => {
    const destroy = vi.fn();
    const view = render(
      <HomeBanner
        port={makePort({ attach: () => ({ destroy }) })}
        adGroupId="ait-ad-test-banner-id"
      />,
    );

    view.unmount();

    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("initializes only once under React Strict Mode", () => {
    const initialize = vi.fn(({ onInitialized }) => onInitialized());

    render(
      <StrictMode>
        <HomeBanner
          port={makePort({ initialize })}
          adGroupId="ait-ad-test-banner-id"
        />
      </StrictMode>,
    );

    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it.each(["no-fill", "failed"] as const)(
    "removes the %s slot",
    async (outcome) => {
      const port = makePort({
        attach: (_adGroupId, _target, callbacks) => {
          if (outcome === "no-fill") callbacks.onNoFill();
          else callbacks.onFailed();
          return { destroy: vi.fn() };
        },
      });

      render(<HomeBanner port={port} adGroupId="ait-ad-test-banner-id" />);

      expect(await screen.findByTestId("home-banner-fallback")).toHaveStyle({
        display: "none",
      });
    },
  );
});
