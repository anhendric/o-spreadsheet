import { featurePluginRegistry } from "@odoo/o-spreadsheet-engine/plugins";
import { Model } from "../../src";
import { ScenarioPlugin } from "../../src/components/side_panel/scenario/scenario_store";
import { setCellContent } from "../test_helpers/commands_helpers";
import { getCellContent } from "../test_helpers/getters_helpers";

let model: Model;

// Ensure plugin is registered
if (!featurePluginRegistry.contains("scenario")) {
  featurePluginRegistry.add("scenario", ScenarioPlugin);
}

beforeEach(() => {
  model = new Model();
});

describe("Scenario Manager Plugin", () => {
  test("Can add and apply scenario", () => {
    setCellContent(model, "A1", "10");

    // Create Scenario via Dispatch
    model.dispatch("ADD_SCENARIO" as any, { name: "Test Scenario", cells: { A1: "50" } });

    const scenarios = (model.getters as any).getScenarios();
    expect(scenarios.length).toBe(1);
    expect(scenarios[0].name).toBe("Test Scenario");
    const id = scenarios[0].id;

    // Apply Scenario via Dispatch
    model.dispatch("APPLY_SCENARIO" as any, { id });
    expect(getCellContent(model, "A1")).toBe("50");
  });

  test("Can remove scenario", () => {
    model.dispatch("ADD_SCENARIO" as any, { name: "S1", cells: {} });
    const s1 = (model.getters as any).getScenarios()[0];

    model.dispatch("REMOVE_SCENARIO" as any, { id: s1.id });
    expect((model.getters as any).getScenarios().length).toBe(0);
  });

  test("Can update scenario", () => {
    model.dispatch("ADD_SCENARIO" as any, { name: "Old Name", cells: { A1: "10" } });
    const s1 = (model.getters as any).getScenarios()[0];

    model.dispatch("UPDATE_SCENARIO" as any, {
      id: s1.id,
      name: "New Name",
      cells: { A1: "20" },
    });

    const updated = (model.getters as any).getScenarios()[0];
    expect(updated.name).toBe("New Name");
    expect(updated.cells["A1"]).toBe("20");
  });
});
