import { useEffect } from "react";

import {
  canUseBannerAds,
  ensureBannerInitialized,
  tossBannerAdsPort,
  type BannerAdsPort,
} from "./banner-adapter";

interface BannerAdsInitializerProps {
  port?: BannerAdsPort;
  adGroupId?: string;
}

export function BannerAdsInitializer({
  port = tossBannerAdsPort,
  adGroupId = import.meta.env.VITE_TOSS_AD_GROUP_ID,
}: BannerAdsInitializerProps) {
  const isSupported = canUseBannerAds(port, adGroupId);

  useEffect(() => {
    if (!isSupported) {
      return;
    }

    return ensureBannerInitialized(port, () => undefined);
  }, [isSupported, port]);

  return null;
}
