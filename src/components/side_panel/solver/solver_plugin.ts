import { UIPlugin } from "@odoo/o-spreadsheet-engine/plugins/ui_plugin";
import { Command } from "@odoo/o-spreadsheet-engine/types/commands";
import { CommandResult } from "../../../types";
import { getSolverStrategy, SolverResult } from "./solver_algorithm";
import { createEvaluateFunction, getVariableBounds, setupSolverProblem } from "./solver_runtime";

// Simple UUID generator
function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface Constraint {
  param: string; // XC
  op: "<=" | "=" | ">=" | "int" | "bin";
  value: string;
}

interface SolverConfig {
  objectiveCell: string | string[]; // Can be multiple cells
  goal: "max" | "min" | "value";
  targetValue: string;
  changingCells: string[]; // List of XC
  constraints: Constraint[];
  algorithm?: "Nelder-Mead" | "BFGS" | "Genetic" | "Gradient Descent" | "PSO" | "SPEA2" | "NSGA-II";
  settings?: {
    maxIter?: number;
    tol?: number;
    mutationRate?: number;
    crossoverRate?: number;
    inertia?: number;
    c1?: number;
    c2?: number;
    domain?: { xc: string; min?: number; max?: number }[];
    recordingSheet?: boolean;
    [key: string]: any;
  };
}

export class SolverPlugin extends UIPlugin {
  static getters = [] as const;
  static layers = [];

  allowDispatch(cmd: Command) {
    return CommandResult.Success;
  }

  handle(cmd: Command) {
    switch (cmd.type) {
      case "SOLVER_SOLVE" as any:
        this.runSolver(cmd as any as SolverConfig);
        break;
    }
  }

  private async runSolver(config: SolverConfig) {
    try {
      const sheetId = this.getters.getActiveSheetId();

      const setup = setupSolverProblem(config, this.getters, sheetId);
      if (!setup) return;
      const { paramCells, x0 } = setup;

      const evaluate = createEvaluateFunction(
        config,
        this.getters,
        this.dispatch.bind(this),
        sheetId,
        paramCells
      );

      const { lowerBound, upperBound } = getVariableBounds(
        config,
        this.getters,
        sheetId,
        paramCells
      );

      // History Recording Setup
      let historySheetId: string | undefined;
      if (config.settings?.recordingSheet) {
        const sheetId = uuid();
        historySheetId = sheetId;
        const sheetResult = this.dispatch("CREATE_SHEET", {
          sheetId,
          position: (this.getters as any).getSheetIds().length,
          name: "Solver Result",
        });

        if (sheetResult.isSuccessful) {
          // Headers: Iteration, Cost, [Variables...]
          const headers = ["Iteration", "Cost"];
          paramCells.forEach((p) => headers.push(`Var(${p.col},${p.row})`));

          headers.forEach((h, index) => {
            this.dispatch("UPDATE_CELL", {
              sheetId: historySheetId!,
              col: index,
              row: 0,
              content: h,
            });
          });
        }
      }

      const onIteration = (res: SolverResult) => {
        if (historySheetId) {
          const row = res.iterations; // 1-indexed for header? No, row 0 is header. Iter 1 -> row 1.
          // Iteration
          this.dispatch("UPDATE_CELL", {
            sheetId: historySheetId!,
            col: 0,
            row,
            content: res.iterations.toString(),
          });
          // Cost
          this.dispatch("UPDATE_CELL", {
            sheetId: historySheetId!,
            col: 1,
            row,
            content: res.cost.toString(),
          });
          // Variables
          res.solution.forEach((val: number, index: number) => {
            this.dispatch("UPDATE_CELL", {
              sheetId: historySheetId!,
              col: 2 + index,
              row,
              content: val.toString(),
            });
          });
        }
      };

      const strategy = getSolverStrategy(config.algorithm || "Nelder-Mead");
      const result = await strategy(x0, evaluate, {
        maxIter: config.settings?.maxIter || 10000,
        tol: config.settings?.tol || 1e-6,
        ...config.settings,
        lowerBound,
        upperBound,
        onIteration, // Pass callback
      });

      // Final update
      evaluate(result.solution);
    } catch (e) {
      console.error("SolverPlugin: Error running solver", e);
    }
  }
}
