/* eslint-disable react-refresh/only-export-components */
import {
  createBrowserRouter,
  createMemoryRouter,
  Navigate,
  type RouteObject,
} from "react-router-dom";

import { ExpensesPage } from "../features/expenses/ExpensesPage";
import { HomePage } from "../features/home/HomePage";
import { OnboardingPage } from "../features/onboarding/OnboardingPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { SpendPage } from "../features/spend/SpendPage";
import { AppShell } from "./AppShell";
import { useAppStore } from "./app-store";
import { LoadingPage } from "./LoadingPage";
import { RecoveryPage } from "./RecoveryPage";

function RootRoute() {
  const { loadState, state } = useAppStore();

  if (loadState === "loading") {
    return <LoadingPage />;
  }

  if (loadState === "corrupt") {
    return <RecoveryPage kind="corrupt" />;
  }

  if (loadState === "unavailable") {
    return <RecoveryPage kind="unavailable" />;
  }

  if (loadState === "empty" || state === null) {
    return <Navigate to="/onboarding" replace />;
  }

  return <HomePage />;
}

function OnboardingRoute() {
  const { loadState, state } = useAppStore();

  if (loadState === "loading") {
    return <LoadingPage />;
  }

  if (loadState === "ready" && state !== null) {
    return <Navigate to="/" replace />;
  }

  return <OnboardingPage />;
}

const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { path: "/", element: <RootRoute /> },
      { path: "/onboarding", element: <OnboardingRoute /> },
      { path: "/spend", element: <SpendPage /> },
      { path: "/expenses", element: <ExpensesPage /> },
      { path: "/settings", element: <SettingsPage /> },
    ],
  },
];

export function createAppRouter(initialEntries?: string[]) {
  return initialEntries === undefined
    ? createBrowserRouter(routes)
    : createMemoryRouter(routes, { initialEntries });
}
