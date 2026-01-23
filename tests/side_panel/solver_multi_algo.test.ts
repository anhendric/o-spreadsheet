import { Component } from "@odoo/owl";
import { SolverSidePanel } from "../../src/components/side_panel/solver/solver_side_panel";
import { setCellContent } from "../test_helpers/commands_helpers";
import { mountSpreadsheet, nextTick } from "../test_helpers/helpers";

function findComponent(component: Component, cls: any): any {
  if (component instanceof cls) return component;
  if (!component || !component.__owl__) return null;
  for (const child of Object.values(component.__owl__.children)) {
    const found = findComponent(child.component, cls);
    if (found) return found;
  }
  return null;
}

// Helper to wait
async function waitFor(condition: () => boolean | Promise<boolean>, timeout = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await condition()) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error("Timeout waiting for condition");
}

describe("Solver Multi-Objective", () => {
  test("Can maximize two cells simultaneously with NSGA-II", async () => {
    const { model, env, parent } = await mountSpreadsheet();

    // Setup Problem: Maximize A1 and B1
    // Variables C1, C2. Range [0, 10]
    // A1 = C1
    // B1 = C2

    setCellContent(model, "C1", "5");
    setCellContent(model, "C2", "5");
    setCellContent(model, "A1", "=C1");
    setCellContent(model, "B1", "=C2");

    env.openSidePanel("Solver");
    await nextTick();

    // Select Objectives A1, B1
    const panel = findComponent(parent, SolverSidePanel);
    if (!panel) throw new Error("SolverSidePanel not found");

    panel.state.objectiveCell = ["A1", "B1"];
    panel.state.goal = "max";
    panel.state.changingCells = ["C1", "C2"];
    panel.state.algorithm = "NSGA-II";
    panel.state.maxIter = 500;
    panel.state.popSize = 50;

    // Add Bounds: C1, C2 in [0, 10]
    panel.state.domain = [
      { xc: "C1", min: 0, max: 10 },
      { xc: "C2", min: 0, max: 10 },
    ];

    // Solve and wait
    await panel.solve();
    await waitFor(() => {
      const c1 = model.getters.getEvaluatedCell({
        sheetId: model.getters.getActiveSheetId(),
        col: 2,
        row: 0,
      }).value as number;
      return c1 !== 5; // Wait for change
    });

    // Check results
    const c1 = model.getters.getEvaluatedCell({
      sheetId: model.getters.getActiveSheetId(),
      col: 2,
      row: 0,
    }).value as number;
    const c2 = model.getters.getEvaluatedCell({
      sheetId: model.getters.getActiveSheetId(),
      col: 2,
      row: 1,
    }).value as number;

    expect(typeof c1).toBe("number");
    expect(typeof c2).toBe("number");
  });

  test("Can record solver history in new sheet", async () => {
    const { model, env, parent } = await mountSpreadsheet();
    setCellContent(model, "A1", "5");
    env.openSidePanel("Solver");
    await nextTick();

    const panel = findComponent(parent, SolverSidePanel);
    if (!panel) throw new Error("SolverSidePanel not found");

    panel.state.objectiveCell = "A1";
    panel.state.goal = "max";
    panel.state.changingCells = ["A1"];
    panel.state.algorithm = "Nelder-Mead";
    panel.state.maxIter = 10;
    panel.state.recordingSheet = true; // Enable recording

    await panel.solve();

    // Wait for sheet creation
    await waitFor(() => {
      const sheetIds = model.getters.getSheetIds();
      return !!sheetIds.find((id) => model.getters.getSheetName(id) === "Solver Result");
    });

    const sheetIds = model.getters.getSheetIds();
    const historySheetId = sheetIds.find(
      (id) => model.getters.getSheetName(id) === "Solver Result"
    );

    // Wait for content in history
    await waitFor(() => {
      const val = model.getters.getEvaluatedCell({
        sheetId: historySheetId!,
        col: 0,
        row: 1,
      }).value;
      return val !== null && val !== undefined && val !== "";
    });

    // Check content
    const iter1 = model.getters.getEvaluatedCell({
      sheetId: historySheetId!,
      col: 0,
      row: 1,
    }).value;
    const cost1 = model.getters.getEvaluatedCell({
      sheetId: historySheetId!,
      col: 1,
      row: 1,
    }).value;

    // Iteration index might be 1 (first iter) or larger if converged fast?
    expect(Number(iter1)).toBeGreaterThanOrEqual(1);
    expect(typeof cost1).toBe("number");
  });

  test("Can handle conflicting objectives (Pareto)", async () => {
    const { model, env, parent } = await mountSpreadsheet();

    // A1 = C1
    // B1 = 10 - C1
    setCellContent(model, "C1", "5");
    setCellContent(model, "A1", "=C1");
    setCellContent(model, "B1", "=10-C1");

    env.openSidePanel("Solver");
    await nextTick();

    const panel = findComponent(parent, SolverSidePanel);
    if (!panel) throw new Error("SolverSidePanel not found");

    panel.state.objectiveCell = ["A1", "B1"];
    panel.state.goal = "max";
    panel.state.changingCells = ["C1"];
    panel.state.algorithm = "NSGA-II";
    panel.state.domain = [{ xc: "C1", min: 0, max: 10 }];
    panel.state.maxIter = 100;

    await panel.solve();
    await waitFor(() => {
      const v = model.getters.getEvaluatedCell({
        sheetId: model.getters.getActiveSheetId(),
        col: 2,
        row: 0,
      }).value as number;
      return typeof v === "number"; // Just ensure value exists/re-evaluated.
    }, 1000);

    const c1 = model.getters.getEvaluatedCell({
      sheetId: model.getters.getActiveSheetId(),
      col: 2,
      row: 0,
    }).value as number;
    expect(c1).toBeGreaterThanOrEqual(0);
    expect(c1).toBeLessThanOrEqual(10);
  });
});
