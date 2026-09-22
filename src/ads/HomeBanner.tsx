import { useEffect, useRef, useState } from "react";

import {
  canUseBannerAds,
  ensureBannerInitialized,
  tossBannerAdsPort,
  type BannerAdsPort,
} from "./banner-adapter";

interface HomeBannerProps {
  port?: BannerAdsPort;
  adGroupId?: string;
}

export function HomeBanner({
  port = tossBannerAdsPort,
  adGroupId = import.meta.env.VITE_TOSS_AD_GROUP_ID,
}: HomeBannerProps) {
  const isSupported = canUseBannerAds(port, adGroupId);
  const [isVisible, setIsVisible] = useState(isSupported);
  const slotRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    let banner: { destroy(): void } | null = null;
    let isActive = true;
    let unsubscribe: () => void = () => undefined;
    const timeoutId = window.setTimeout(() => {
      if (!isActive) {
        return;
      }

      isActive = false;
      unsubscribe();
      setIsVisible(false);
    }, 3_000);

    unsubscribe = ensureBannerInitialized(port, (ready) => {
      window.clearTimeout(timeoutId);
      if (!isActive || !ready || slotRef.current === null) {
        if (!ready) setIsVisible(false);
        return;
      }

      try {
        banner = port.attach(adGroupId, slotRef.current, {
          onRendered: () => setIsVisible(true),
          onNoFill: () => setIsVisible(false),
          onFailed: () => setIsVisible(false),
        });
      } catch {
        setIsVisible(false);
      }
    });

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      unsubscribe();
      banner?.destroy();
    };
  }, [adGroupId, isSupported, port]);

  if (!isSupported) {
    return null;
  }

  return (
    <div
      ref={slotRef}
      className="home-banner-slot"
      data-testid={isVisible ? "home-banner-slot" : "home-banner-fallback"}
      style={{
        display: isVisible ? "block" : "none",
        width: "100%",
        height: 96,
      }}
    />
  );
}
