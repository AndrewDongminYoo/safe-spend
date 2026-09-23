import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { SafeSpendStateV2 } from "../domain/model";
import type { StateRepository } from "../storage/state-repository";

export interface AppStoreValue {
  loadState: "loading" | "empty" | "ready" | "corrupt" | "unavailable";
  state: SafeSpendStateV2 | null;
  corruptRaw: string | null;
  isSaving: boolean;
  persistenceMode: "storage" | "session";
  persistenceError: string | null;
  mutate(
    transform: (current: SafeSpendStateV2) => SafeSpendStateV2,
  ): Promise<boolean>;
  initialize(state: SafeSpendStateV2): Promise<boolean>;
  retrySave(): Promise<boolean>;
  retryLoad(): Promise<void>;
  continueWithoutStorage(): void;
  resetAfterConfirmation(): Promise<boolean>;
}

interface AppStoreProviderProps extends PropsWithChildren {
  repository: StateRepository;
  now?: () => string;
}

const AppStoreContext = createContext<AppStoreValue | null>(null);

export function AppStoreProvider({
  children,
  repository,
  now = () => new Date().toISOString(),
}: AppStoreProviderProps) {
  const [loadState, setLoadState] =
    useState<AppStoreValue["loadState"]>("loading");
  const [state, setState] = useState<SafeSpendStateV2 | null>(null);
  const [corruptRaw, setCorruptRaw] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [persistenceMode, setPersistenceMode] =
    useState<AppStoreValue["persistenceMode"]>("storage");
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const stateRef = useRef<SafeSpendStateV2 | null>(null);
  const isSavingRef = useRef(false);
  const persistenceModeRef =
    useRef<AppStoreValue["persistenceMode"]>("storage");

  const updateState = useCallback((nextState: SafeSpendStateV2 | null) => {
    stateRef.current = nextState;
    setState(nextState);
  }, []);

  const applyLoadResult = useCallback(
    (result: Awaited<ReturnType<StateRepository["load"]>>) => {
      setLoadState(result.kind);
      setCorruptRaw(result.kind === "corrupt" ? result.raw : null);
      updateState(result.kind === "ready" ? result.state : null);
    },
    [updateState],
  );

  useEffect(() => {
    let isActive = true;

    void repository.load().then((result) => {
      if (!isActive) {
        return;
      }

      applyLoadResult(result);
    });

    return () => {
      isActive = false;
    };
  }, [applyLoadResult, repository]);

  const retryLoad = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    applyLoadResult(await repository.load());
  }, [applyLoadResult, repository]);

  const continueWithoutStorage = useCallback(() => {
    persistenceModeRef.current = "session";
    setPersistenceMode("session");
    setPersistenceError(null);
    updateState(null);
    setCorruptRaw(null);
    setLoadState("empty");
  }, [updateState]);

  const persistSnapshot = useCallback(
    async (snapshot: SafeSpendStateV2): Promise<boolean> => {
      try {
        if (persistenceModeRef.current === "session") {
          setPersistenceError(null);
          return true;
        }

        await repository.save(snapshot);
        setPersistenceError(null);
        return true;
      } catch {
        setPersistenceError("저장하지 못했어요");
        return false;
      } finally {
        isSavingRef.current = false;
        setIsSaving(false);
      }
    },
    [repository],
  );

  const initialize = useCallback(
    async (initialState: SafeSpendStateV2): Promise<boolean> => {
      if (isSavingRef.current) {
        return false;
      }

      isSavingRef.current = true;
      setIsSaving(true);
      const snapshot = { ...initialState, updatedAt: now() };
      updateState(snapshot);
      setLoadState("ready");
      setCorruptRaw(null);
      return persistSnapshot(snapshot);
    },
    [now, persistSnapshot, updateState],
  );

  const mutate = useCallback(
    async (
      transform: (current: SafeSpendStateV2) => SafeSpendStateV2,
    ): Promise<boolean> => {
      const current = stateRef.current;

      if (current === null || isSavingRef.current) {
        return false;
      }

      isSavingRef.current = true;
      setIsSaving(true);

      let snapshot: SafeSpendStateV2;
      try {
        snapshot = { ...transform(current), updatedAt: now() };
      } catch (error) {
        isSavingRef.current = false;
        setIsSaving(false);
        throw error;
      }

      updateState(snapshot);
      return persistSnapshot(snapshot);
    },
    [now, persistSnapshot, updateState],
  );

  const retrySave = useCallback(async (): Promise<boolean> => {
    const snapshot = stateRef.current;

    if (snapshot === null || isSavingRef.current) {
      return false;
    }

    isSavingRef.current = true;
    setIsSaving(true);
    return persistSnapshot(snapshot);
  }, [persistSnapshot]);

  const resetAfterConfirmation = useCallback(async (): Promise<boolean> => {
    if (isSavingRef.current) {
      return false;
    }

    isSavingRef.current = true;
    setIsSaving(true);

    try {
      if (persistenceModeRef.current === "storage") {
        await repository.clear();
      }
      updateState(null);
      setCorruptRaw(null);
      setLoadState("empty");
      setPersistenceError(null);
      return true;
    } catch {
      setPersistenceError("초기화하지 못했어요");
      return false;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [repository, updateState]);

  const value = useMemo<AppStoreValue>(
    () => ({
      loadState,
      state,
      corruptRaw,
      isSaving,
      persistenceMode,
      persistenceError,
      mutate,
      initialize,
      retrySave,
      retryLoad,
      continueWithoutStorage,
      resetAfterConfirmation,
    }),
    [
      corruptRaw,
      initialize,
      isSaving,
      loadState,
      mutate,
      persistenceMode,
      persistenceError,
      resetAfterConfirmation,
      retrySave,
      retryLoad,
      continueWithoutStorage,
      state,
    ],
  );

  return (
    <AppStoreContext.Provider value={value}>
      {children}
    </AppStoreContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppStore(): AppStoreValue {
  const value = useContext(AppStoreContext);

  if (value === null) {
    throw new Error("useAppStore must be used inside AppStoreProvider");
  }

  return value;
}
