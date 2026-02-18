import { ConsolePanel } from "../../src/components/side_panel/console/console_panel";
import { mountComponent } from "../test_helpers/helpers";

describe("ConsolePanel", () => {
  test("Can render ConsolePanel", async () => {
    const { fixture } = await mountComponent(ConsolePanel, {
      env: {
        openSidePanel: () => {},
      },
    });

    // Check if input exists
    expect(fixture.querySelector(".o-console-input-field")).toBeTruthy();
    // Check if placeholder is correct
    expect((fixture.querySelector(".o-console-input-field") as HTMLInputElement).placeholder).toBe(
      "Type JS code (e.g. 1+1, A1, SUM(1,2))..."
    );
  });

  // We can add more tests here to verify interaction if needed,
  // but due to complexity of environment mocking for eval (getters etc),
  // a basic render test confirms the component loads and XML is valid.
});
