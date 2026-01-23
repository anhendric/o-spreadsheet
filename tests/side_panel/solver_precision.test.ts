import { Model } from "../../src";
import { setCellContent } from "../test_helpers/commands_helpers";
import { getCellContent } from "../test_helpers/getters_helpers";

describe("Solver Precision", () => {
  let model: Model;

  beforeEach(() => {
    model = new Model();
  });

  const waitForSolver = async () => new Promise((resolve) => setTimeout(resolve, 100));

  test("Solver Minimization (Rosenbrock)", async () => {
    // Rosenbrock function: f(x, y) = (a-x)^2 + b(y-x^2)^2
    // a=1, b=100. Min at (1, 1) is 0.
    // A1 = (1 - B1)^2 + 100 * (C1 - B1^2)^2
    setCellContent(model, "B1", "0"); // x
    setCellContent(model, "C1", "0"); // y
    setCellContent(model, "A1", "=POWER(1-B1, 2) + 100*POWER(C1-POWER(B1, 2), 2)");

    model.dispatch("SOLVER_SOLVE" as any, {
      objectiveCell: "A1",
      goal: "min",
      targetValue: "0",
      changingCells: ["B1", "C1"],
      constraints: [],
    });

    // Loop wait for async solver
    let iter = 0;
    while (iter < 50) {
      // Max 5 seconds
      await waitForSolver();
      const val = parseFloat(getCellContent(model, "A1"));
      if (val < 1e-5) break;
      iter++;
    }

    const resX = parseFloat(getCellContent(model, "B1"));
    const resY = parseFloat(getCellContent(model, "C1"));
    const obj = parseFloat(getCellContent(model, "A1"));

    // Should be very close to 1, 1
    expect(Math.abs(resX - 1)).toBeLessThan(0.01);
    expect(Math.abs(resY - 1)).toBeLessThan(0.01);
    expect(obj).toBeLessThan(1e-4);
  });

  test("Solver Maximization (Constraint x <= 5.5)", async () => {
    setCellContent(model, "B1", "0");
    setCellContent(model, "A1", "=B1");

    model.dispatch("SOLVER_SOLVE" as any, {
      objectiveCell: "A1",
      goal: "max",
      targetValue: "0",
      changingCells: ["B1"],
      constraints: [{ param: "B1", op: "<=", value: "5.5" }],
    });

    let iter = 0;
    while (iter < 20) {
      await waitForSolver();
      const val = parseFloat(getCellContent(model, "B1"));
      if (val > 5.4) break;
      iter++;
    }

    const res = parseFloat(getCellContent(model, "B1"));
    // Should hit boundary very precisely
    expect(Math.abs(res - 5.5)).toBeLessThan(0.001);
  });

  test("Solver Target Value with equation", async () => {
    // x^2 = 25 -> x = 5 (starting positive)
    setCellContent(model, "B1", "1");
    setCellContent(model, "A1", "=B1*B1");

    model.dispatch("SOLVER_SOLVE" as any, {
      objectiveCell: "A1",
      goal: "value",
      targetValue: "25",
      changingCells: ["B1"],
      constraints: [],
    });

    let iter = 0;
    while (iter < 20) {
      await waitForSolver();
      const val = parseFloat(getCellContent(model, "B1"));
      if (Math.abs(val - 5) < 0.1) break;
      iter++;
    }

    const res = parseFloat(getCellContent(model, "B1"));
    expect(Math.abs(res - 5)).toBeLessThan(0.001);
  });
});
