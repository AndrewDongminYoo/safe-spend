import { render, screen } from "@testing-library/react";
import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { describe, expect, it } from "vitest";

import App from "./App";

describe("App", () => {
  it("introduces the safe-to-spend amount", () => {
    render(
      <TDSMobileAITProvider brandPrimaryColor="#3182F6">
        <App />
      </TDSMobileAITProvider>,
    );

    expect(
      screen.getByText("다음 수입일까지 써도 되는 돈"),
    ).toBeInTheDocument();
  });
});
