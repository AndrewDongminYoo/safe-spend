import { Button } from "@toss/tds-mobile";
import { useState } from "react";

import { PageScaffold } from "../components/PageScaffold";
import { useAppStore } from "./app-store";

interface RecoveryPageProps {
  kind: "corrupt" | "unavailable";
}

export function RecoveryPage({ kind }: RecoveryPageProps) {
  const { continueWithoutStorage, resetAfterConfirmation, retryLoad } =
    useAppStore();
  const [isConfirming, setIsConfirming] = useState(false);

  if (kind === "unavailable") {
    return (
      <PageScaffold
        title="저장소에 연결하지 못했어요"
        subtitle="다시 연결하거나, 이번 세션에서만 저장 없이 시작할 수 있어요."
      >
        <div style={{ display: "grid", gap: 8 }}>
          <Button display="block" onClick={() => void retryLoad()}>
            다시 시도하기
          </Button>
          <Button
            display="block"
            variant="weak"
            onClick={continueWithoutStorage}
          >
            저장 없이 시작하기
          </Button>
        </div>
      </PageScaffold>
    );
  }

  return (
    <PageScaffold
      title="저장된 데이터를 읽지 못했어요"
      subtitle="원본 데이터는 그대로 보관 중이에요. 초기화하면 복구할 수 없어요."
    >
      {isConfirming ? (
        <Button color="danger" onClick={() => void resetAfterConfirmation()}>
          초기화하기
        </Button>
      ) : (
        <Button variant="weak" onClick={() => setIsConfirming(true)}>
          저장 데이터 초기화
        </Button>
      )}
    </PageScaffold>
  );
}
