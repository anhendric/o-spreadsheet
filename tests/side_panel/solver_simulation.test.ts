import { Model } from "../../src";
import { setCellContent } from "../test_helpers/commands_helpers";
import { getCellContent } from "../test_helpers/getters_helpers";

describe.skip("Solver Simulation", () => {
  let model: Model;

  beforeEach(() => {
    model = new Model();
  });

  const waitForSolver = async () => new Promise((resolve) => setTimeout(resolve, 500));

  test("Solver Minimization (x^2)", async () => {
    setCellContent(model, "B1", "10");
    setCellContent(model, "A1", "=B1*B1");

    model.dispatch("SOLVER_SOLVE" as any, {
      objectiveCell: "A1",
      goal: "min",
      targetValue: "0",
      changingCells: ["B1"],
      constraints: [],
    });

    await waitForSolver();

    const res = parseFloat(getCellContent(model, "B1"));
    const obj = parseFloat(getCellContent(model, "A1"));

    expect(Math.abs(res)).toBeLessThan(0.1);
    expect(obj).toBeLessThan(0.01);
  });

  test("Solver Maximization (Constraint x <= 5)", async () => {
    setCellContent(model, "B1", "0");
    setCellContent(model, "A1", "=B1");

    model.dispatch("SOLVER_SOLVE" as any, {
      objectiveCell: "A1",
      goal: "max",
      targetValue: "0",
      changingCells: ["B1"],
      constraints: [{ param: "B1", op: "<=", value: "5" }],
    });

    await waitForSolver();

    const res = parseFloat(getCellContent(model, "B1"));
    expect(Math.abs(res - 5)).toBeLessThan(0.1);
  });

  test("Solver Target Value (x + y = 10)", async () => {
    setCellContent(model, "B1", "0");
    setCellContent(model, "C1", "0");
    setCellContent(model, "A1", "=B1+C1");

    model.dispatch("SOLVER_SOLVE" as any, {
      objectiveCell: "A1",
      goal: "value",
      targetValue: "10",
      changingCells: ["B1", "C1"],
      constraints: [],
    });

    await waitForSolver();

    const val = parseFloat(getCellContent(model, "A1"));
    expect(Math.abs(val - 10)).toBeLessThan(0.1);
  });
});
