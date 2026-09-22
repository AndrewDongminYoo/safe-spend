import { useState } from "react";
import { RouterProvider } from "react-router-dom";

import { AppStoreProvider } from "./app/app-store";
import { createAppRouter } from "./app/router";
import {
  appsInTossStateRepository,
  type StateRepository,
} from "./storage/state-repository";

interface AppProps {
  repository?: StateRepository;
  now?: () => string;
}

function systemNow(): string {
  return new Date().toISOString();
}

function App({
  repository = appsInTossStateRepository,
  now = systemNow,
}: AppProps) {
  const [router] = useState(createAppRouter);

  return (
    <AppStoreProvider repository={repository} now={now}>
      <RouterProvider router={router} />
    </AppStoreProvider>
  );
}

export default App;
