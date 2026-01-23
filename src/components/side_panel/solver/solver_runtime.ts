interface Constraint {
  param: string;
  op: "<=" | "=" | ">=" | "int" | "bin";
  value: string;
}

interface SolverConfig {
  objectiveCell: string | string[];
  goal: "max" | "min" | "value";
  targetValue: string;
  changingCells: string[];
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
    [key: string]: any;
  };
}

export function setupSolverProblem(config: SolverConfig, getters: any, sheetId: string) {
  const paramCells: { col: number; row: number; xc: string }[] = [];

  for (const rangeXc of config.changingCells) {
    const range = getters.getRangeFromSheetXC(sheetId, rangeXc);
    if (!range) continue;
    for (let r = range.zone.top; r <= range.zone.bottom; r++) {
      for (let c = range.zone.left; c <= range.zone.right; c++) {
        paramCells.push({ col: c, row: r, xc: "" });
      }
    }
  }

  if (paramCells.length === 0) return null;

  // Initial Vector x0
  const x0 = paramCells.map((p) => {
    const cell = getters.getEvaluatedCell({ sheetId, col: p.col, row: p.row });
    const val = cell ? cell.value : 0;
    return typeof val === "number" ? val : 0;
  });

  return { paramCells, x0 };
}

export function createEvaluateFunction(
  config: SolverConfig,
  getters: any,
  dispatch: (cmd: string, args: any) => void,
  sheetId: string,
  paramCells: { col: number; row: number }[]
) {
  const n = paramCells.length;

  return (x: number[]): number | number[] => {
    // Write x to cells
    for (let i = 0; i < n; i++) {
      dispatch("UPDATE_CELL", {
        sheetId,
        col: paramCells[i].col,
        row: paramCells[i].row,
        content: String(x[i]),
      });
    }

    // Simplified approach: Resolve domain XCs to cells, then match with paramCells
    let lowerBound: number[] | undefined;
    let upperBound: number[] | undefined;

    if (config.settings?.domain?.length) {
      lowerBound = new Array(n).fill(-Infinity);
      upperBound = new Array(n).fill(Infinity);

      for (const d of config.settings.domain) {
        const ranges = getters.getRangeFromSheetXC(sheetId, d.xc);
        if (ranges) {
          for (let r = ranges.zone.top; r <= ranges.zone.bottom; r++) {
            for (let c = ranges.zone.left; c <= ranges.zone.right; c++) {
              // Find index in paramCells
              const idx = paramCells.findIndex((p) => p.col === c && p.row === r);
              if (idx !== -1) {
                if (d.min !== undefined && d.min !== null) lowerBound[idx] = d.min;
                if (d.max !== undefined && d.max !== null) upperBound[idx] = d.max;
              }
            }
          }
        }
      }
    }

    // Read Objective(s)
    const objCells: string[] = Array.isArray(config.objectiveCell)
      ? config.objectiveCell
      : [config.objectiveCell];

    const costs: number[] = [];

    // Constraints Penalty
    let penalty = 0;
    const PENALTY_WEIGHT = 1e6;

    for (const c of config.constraints) {
      const subjRange = getters.getRangeFromSheetXC(sheetId, c.param);
      if (!subjRange) continue;
      const subjCell = getters.getEvaluatedCell({
        sheetId,
        col: subjRange.zone.left,
        row: subjRange.zone.top,
      });
      const subjVal = subjCell && typeof subjCell.value === "number" ? subjCell.value : 0;

      let targetVal = parseFloat(c.value);
      if (isNaN(targetVal)) {
        // Try as cell ref
        const tRange = getters.getRangeFromSheetXC(sheetId, c.value);
        if (tRange) {
          const tCell = getters.getEvaluatedCell({
            sheetId,
            col: tRange.zone.left,
            row: tRange.zone.top,
          });
          if (tCell && typeof tCell.value === "number") targetVal = tCell.value;
          else targetVal = 0;
        } else {
          targetVal = 0;
        }
      }

      if (c.op === "<=") {
        if (subjVal > targetVal) penalty += (subjVal - targetVal) * PENALTY_WEIGHT;
      } else if (c.op === ">=") {
        if (subjVal < targetVal) penalty += (targetVal - subjVal) * PENALTY_WEIGHT;
      } else if (c.op === "=") {
        penalty += Math.abs(subjVal - targetVal) * PENALTY_WEIGHT;
      }
    }

    for (const objXc of objCells) {
      const objRange = getters.getRangeFromSheetXC(sheetId, objXc);
      // If range not found, push Infinity
      if (!objRange) {
        costs.push(Infinity);
        continue;
      }

      const objCell = getters.getEvaluatedCell({
        sheetId,
        col: objRange.zone.left,
        row: objRange.zone.top,
      });
      let val = objCell ? objCell.value : 0;
      if (typeof val !== "number") val = 0; // Handle non-numeric

      let error = 0;
      if (config.goal === "min") error = val;
      else if (config.goal === "max") error = -val;
      else {
        const t = parseFloat(config.targetValue) || 0;
        error = Math.pow(val - t, 2);
      }

      // Add penalty to EACH objective? Yes, constraints violation should penalize all solutions.
      costs.push(error + penalty);
    }

    // Return number if single objective, array if multi
    // Note: For algorithms expecting number, createEvaluateFunction signature
    // implies return number | number[]. The algorithm casts it.
    // We will default to returning number if 1 objective to be safe/backward compatible
    // But if config has multiple objectives, we MUST return array.

    if (costs.length === 1) return costs[0];
    return costs;
  };
}

export function getVariableBounds(
  config: SolverConfig,
  getters: any,
  sheetId: string,
  paramCells: { col: number; row: number }[]
) {
  const n = paramCells.length;
  let lowerBound: number[] | undefined;
  let upperBound: number[] | undefined;

  if (config.settings?.domain?.length) {
    lowerBound = new Array(n).fill(-Infinity);
    upperBound = new Array(n).fill(Infinity);

    for (const d of config.settings.domain) {
      const ranges = getters.getRangeFromSheetXC(sheetId, d.xc);
      if (ranges) {
        for (let r = ranges.zone.top; r <= ranges.zone.bottom; r++) {
          for (let c = ranges.zone.left; c <= ranges.zone.right; c++) {
            // Find index in paramCells
            const idx = paramCells.findIndex((p) => p.col === c && p.row === r);
            if (idx !== -1) {
              if (d.min !== undefined && d.min !== null) lowerBound[idx] = d.min;
              if (d.max !== undefined && d.max !== null) upperBound[idx] = d.max;
            }
          }
        }
      }
    }
  }
  return { lowerBound, upperBound };
}
