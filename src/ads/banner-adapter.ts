import { isMinVersionSupported, TossAds } from "@apps-in-toss/web-framework";

export interface BannerAdsPort {
  isVersionSupported(): boolean;
  isInitializeSupported(): boolean;
  initialize(callbacks: {
    onInitialized(): void;
    onInitializationFailed(): void;
  }): void;
  isAttachSupported(): boolean;
  attach(
    adGroupId: string,
    target: HTMLElement,
    callbacks: { onRendered(): void; onNoFill(): void; onFailed(): void },
  ): { destroy(): void };
}

type InitializationStatus = "idle" | "pending" | "ready" | "failed";

let initializationStatus: InitializationStatus = "idle";
const initializationListeners = new Set<(ready: boolean) => void>();

function finishInitialization(ready: boolean): void {
  initializationStatus = ready ? "ready" : "failed";
  for (const listener of initializationListeners) {
    listener(ready);
  }
  initializationListeners.clear();
}

export function ensureBannerInitialized(
  port: BannerAdsPort,
  onResult: (ready: boolean) => void,
): () => void {
  if (initializationStatus === "ready" || initializationStatus === "failed") {
    onResult(initializationStatus === "ready");
    return () => undefined;
  }

  initializationListeners.add(onResult);

  if (initializationStatus === "idle") {
    initializationStatus = "pending";
    try {
      port.initialize({
        onInitialized: () => finishInitialization(true),
        onInitializationFailed: () => finishInitialization(false),
      });
    } catch {
      finishInitialization(false);
    }
  }

  return () => {
    initializationListeners.delete(onResult);
  };
}

export function resetBannerInitializationForTests(): void {
  initializationStatus = "idle";
  initializationListeners.clear();
}

export function canUseBannerAds(
  port: BannerAdsPort,
  adGroupId: string | undefined,
): adGroupId is string {
  return (
    typeof adGroupId === "string" &&
    adGroupId.length > 0 &&
    port.isVersionSupported() &&
    port.isInitializeSupported() &&
    port.isAttachSupported()
  );
}

export const tossBannerAdsPort: BannerAdsPort = {
  isVersionSupported: () =>
    isMinVersionSupported({ android: "5.241.0", ios: "5.241.0" }),
  isInitializeSupported: () => TossAds.initialize.isSupported(),
  initialize: (callbacks) => TossAds.initialize({ callbacks }),
  isAttachSupported: () => TossAds.attachBanner.isSupported(),
  attach: (adGroupId, target, callbacks) =>
    TossAds.attachBanner(adGroupId, target, {
      theme: "auto",
      tone: "blackAndWhite",
      variant: "expanded",
      callbacks: {
        onAdRendered: callbacks.onRendered,
        onNoFill: callbacks.onNoFill,
        onAdFailedToRender: callbacks.onFailed,
      },
    }),
};
