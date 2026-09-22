import { Button } from "@toss/tds-mobile";
import { Outlet } from "react-router-dom";

import { BannerAdsInitializer } from "../ads/BannerAdsInitializer";
import { useAppStore } from "./app-store";

export function AppShell() {
  const { persistenceError, retrySave } = useAppStore();

  return (
    <>
      <BannerAdsInitializer />
      {persistenceError === null ? null : (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "12px 20px",
            background: "#fff3f0",
          }}
        >
          <span>저장하지 못했어요</span>
          <Button size="small" variant="weak" onClick={() => void retrySave()}>
            다시 저장하기
          </Button>
        </div>
      )}
      <Outlet />
    </>
  );
}
