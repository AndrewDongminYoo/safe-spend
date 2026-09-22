import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TDSMobileAITProvider } from "@toss/tds-mobile-ait";
import { useState } from "react";
import { expect, it } from "vitest";

import { WonTextField } from "./WonTextField";

function Probe() {
  const [value, setValue] = useState("");
  return (
    <WonTextField label="현재 잔액" value={value} onValueChange={setValue} />
  );
}

it("exposes the unformatted won value to assistive technology", async () => {
  const user = userEvent.setup();
  render(
    <TDSMobileAITProvider brandPrimaryColor="#3182F6">
      <Probe />
    </TDSMobileAITProvider>,
  );

  const input = screen.getByLabelText("현재 잔액");
  await user.type(input, "650000");

  expect(input).toHaveAccessibleDescription("현재 잔액 입력값 650000원");
});
