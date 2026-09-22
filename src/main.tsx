import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import appConfig from "../apps-in-toss.config";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TDSMobileAITProvider brandPrimaryColor={appConfig.brand.primaryColor}>
      <App />
    </TDSMobileAITProvider>
  </StrictMode>,
);
