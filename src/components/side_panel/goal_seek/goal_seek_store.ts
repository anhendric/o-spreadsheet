import { Get } from "../../../store_engine";
import { SpreadsheetStore } from "../../../stores";
import { CellPosition, Command } from "../../../types";

const MAX_ITERATIONS = 100;

export type GoalSeekAlgorithm = "Secant" | "BinarySearch" | "Newton" | "Brent";

export class GoalSeekStore extends SpreadsheetStore {
  mutators = ["goalSeek"] as const;

  constructor(get: Get) {
    super(get);
  }

  goalSeek(
    setCell: CellPosition,
    toValue: number,
    byChangingCell: CellPosition,
    algorithm: GoalSeekAlgorithm = "Secant",
    epsilon: number = 1e-7,
    minValue?: number,
    maxValue?: number
  ) {
    if (algorithm === "BinarySearch") {
      this.goalSeekBinarySearch(setCell, toValue, byChangingCell, epsilon, minValue, maxValue);
    } else if (algorithm === "Newton") {
      this.goalSeekNewton(setCell, toValue, byChangingCell, epsilon, minValue, maxValue);
    } else if (algorithm === "Brent") {
      this.goalSeekBrent(setCell, toValue, byChangingCell, epsilon, minValue, maxValue);
    } else {
      this.goalSeekSecant(setCell, toValue, byChangingCell, epsilon, minValue, maxValue);
    }
  }

  private goalSeekSecant(
    setCell: CellPosition,
    toValue: number,
    byChangingCell: CellPosition,
    epsilon: number,
    minValue?: number,
    maxValue?: number
  ) {
    const startValue = this.getters.getEvaluatedCell(byChangingCell).value;
    let x0 = typeof startValue === "number" ? startValue : parseFloat(String(startValue)) || 0;

    // Clamp initial
    if (minValue !== undefined) x0 = Math.max(x0, minValue);
    if (maxValue !== undefined) x0 = Math.min(x0, maxValue);

    let x1 = x0 + (x0 === 0 ? 0.1 : x0 * 0.001);
    // Clamp x1 if needed
    if (minValue !== undefined) x1 = Math.max(x1, minValue);
    if (maxValue !== undefined) x1 = Math.min(x1, maxValue);
    if (Math.abs(x1 - x0) < 1e-9) {
      x1 = x0 + 0.1; // Try forcing a step if clamped to same
      if (maxValue !== undefined && x1 > maxValue) x1 = x0 - 0.1;
      if (minValue !== undefined && x1 < minValue) x1 = x0; // Can't move
    }

    let y0 = this.evaluateAt(setCell, byChangingCell, x0);

    if (Math.abs(y0 - toValue) < epsilon) {
      this.updateCell(byChangingCell, x0); // Ensure update
      return; // Already there
    }

    let y1 = this.evaluateAt(setCell, byChangingCell, x1);

    let i = 0;
    while (i < MAX_ITERATIONS) {
      if (Math.abs(y1 - toValue) < epsilon) {
        this.updateCell(byChangingCell, x1);
        return;
      }

      // We use a small hardcoded threshold for flat slope detection to avoid division by zero
      // or massive jumps, independent of the user's target precision.
      if (Math.abs(y1 - y0) < 1e-9) {
        break;
      }

      let x2 = x1 - ((y1 - toValue) * (x1 - x0)) / (y1 - y0);

      // Clamp x2
      if (minValue !== undefined) x2 = Math.max(x2, minValue);
      if (maxValue !== undefined) x2 = Math.min(x2, maxValue);

      x0 = x1;
      y0 = y1;
      x1 = x2;
      y1 = this.evaluateAt(setCell, byChangingCell, x1);

      i++;
    }
    this.updateCell(byChangingCell, x1);
  }

  private goalSeekBinarySearch(
    setCell: CellPosition,
    toValue: number,
    byChangingCell: CellPosition,
    epsilon: number,
    minValue?: number,
    maxValue?: number
  ) {
    // 1. Find a bracket [low, high]
    let low = typeof minValue === "number" ? minValue : -1000;
    let high = typeof maxValue === "number" ? maxValue : 1000;

    // Check bounds first if provided
    if (minValue !== undefined) {
      const yMin = this.evaluateAt(setCell, byChangingCell, minValue);
      if (Math.abs(yMin - toValue) < epsilon) {
        this.updateCell(byChangingCell, minValue);
        return;
      }
    }
    if (maxValue !== undefined) {
      const yMax = this.evaluateAt(setCell, byChangingCell, maxValue);
      if (Math.abs(yMax - toValue) < epsilon) {
        this.updateCell(byChangingCell, maxValue);
        return;
      }
    }

    // Basic approach: try to find sign change.
    // Evaluate center
    const startValue = this.getters.getEvaluatedCell(byChangingCell).value;
    let center = typeof startValue === "number" ? startValue : parseFloat(String(startValue)) || 0;

    // Clamp center
    if (minValue !== undefined) center = Math.max(center, minValue);
    if (maxValue !== undefined) center = Math.min(center, maxValue);

    const yCenter = this.evaluateAt(setCell, byChangingCell, center);
    if (Math.abs(yCenter - toValue) < epsilon) return;

    // Check direction
    // If center is at bounds, we can only check one side.
    let checkStep = 1;
    if (center >= (maxValue ?? Infinity)) checkStep = -1;
    else if (center <= (minValue ?? -Infinity)) checkStep = 1;

    const yPlus = this.evaluateAt(setCell, byChangingCell, center + checkStep);

    // Determine effective direction
    let increasing = yPlus > yCenter;
    if (checkStep < 0) increasing = !increasing; // If we stepped back, logic flips

    // If bounded, check if the root is out of bounds
    if (maxValue !== undefined) {
      const yMax = this.evaluateAt(setCell, byChangingCell, maxValue);
      // If we increasing and yMax < toValue, we can never reach it inside bounds.
      // Return max.
      if (increasing && yMax < toValue) {
        this.updateCell(byChangingCell, maxValue);
        return;
      }
      if (!increasing && yMax > toValue) {
        this.updateCell(byChangingCell, maxValue);
        return;
      }
    }
    if (minValue !== undefined) {
      const yMin = this.evaluateAt(setCell, byChangingCell, minValue);
      if (increasing && yMin > toValue) {
        this.updateCell(byChangingCell, minValue);
        return;
      }
      if (!increasing && yMin < toValue) {
        this.updateCell(byChangingCell, minValue);
        return;
      }
    }

    // Heuristic bracket finding
    let step = 1;
    let foundBracket = false;
    let iter = 0;

    // Move 'low' and 'high'
    low = center;
    high = center;

    // Decide which way to search based on slope
    // If increasing and yCenter < toValue => need higher x => right
    // If increasing and yCenter > toValue => need lower x => left
    const goRight = (increasing && yCenter < toValue) || (!increasing && yCenter > toValue);

    if (goRight) {
      // Search UP
      while (iter < 20) {
        high += step;
        if (maxValue !== undefined && high > maxValue) {
          high = maxValue;
          step = 0; // Stop expanding
        }
        const y = this.evaluateAt(setCell, byChangingCell, high);
        if ((increasing && y >= toValue) || (!increasing && y <= toValue)) {
          foundBracket = true;
          break;
        }
        if (maxValue !== undefined && high >= maxValue) break; // Limit reached
        step *= 2;
        iter++;
      }
    } else {
      // Search DOWN
      while (iter < 20) {
        low -= step;
        if (minValue !== undefined && low < minValue) {
          low = minValue;
          step = 0;
        }
        const y = this.evaluateAt(setCell, byChangingCell, low);
        if ((increasing && y <= toValue) || (!increasing && y >= toValue)) {
          foundBracket = true;
          break;
        }
        if (minValue !== undefined && low <= minValue) break; // Limit reached
        step *= 2;
        iter++;
      }
    }

    if (!foundBracket) {
      // If we hit a bound and didn't find it, we return the bound that is closest
      // Just update to best guess (current low or high)
      // This handles the "clamping" effect
      const valLow = Math.abs(this.evaluateAt(setCell, byChangingCell, low) - toValue);
      const valHigh = Math.abs(this.evaluateAt(setCell, byChangingCell, high) - toValue);
      this.updateCell(byChangingCell, valLow < valHigh ? low : high);
      return;
    }

    // Binary Search
    for (let k = 0; k < MAX_ITERATIONS; k++) {
      const mid = (low + high) / 2;
      const yMid = this.evaluateAt(setCell, byChangingCell, mid);

      if (Math.abs(yMid - toValue) < epsilon) {
        this.updateCell(byChangingCell, mid);
        return;
      }

      if (increasing) {
        if (yMid < toValue) low = mid;
        else high = mid;
      } else {
        if (yMid > toValue) low = mid;
        else high = mid;
      }
    }
    this.updateCell(byChangingCell, (low + high) / 2);
  }

  private goalSeekNewton(
    setCell: CellPosition,
    toValue: number,
    byChangingCell: CellPosition,
    epsilon: number,
    minValue?: number,
    maxValue?: number
  ) {
    const startValue = this.getters.getEvaluatedCell(byChangingCell).value;
    let x = typeof startValue === "number" ? startValue : parseFloat(String(startValue)) || 0;

    if (minValue !== undefined) x = Math.max(x, minValue);
    if (maxValue !== undefined) x = Math.min(x, maxValue);

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      const y = this.evaluateAt(setCell, byChangingCell, x);
      if (Math.abs(y - toValue) < epsilon) {
        return;
      }

      // Estimate derivative
      let h = 1e-4; // small step
      // Adjust h if at bounds to stay inside or at least computable
      if (maxValue !== undefined && x + h > maxValue) h = -h;

      const yPlus = this.evaluateAt(setCell, byChangingCell, x + h);
      const derivative = (yPlus - y) / h;

      if (Math.abs(derivative) < 1e-9) {
        break; // Zero derivative
      }

      let xNext = x - (y - toValue) / derivative;

      // Clamp
      if (minValue !== undefined) xNext = Math.max(xNext, minValue);
      if (maxValue !== undefined) xNext = Math.min(xNext, maxValue);

      x = xNext;
    }
    this.updateCell(byChangingCell, x);
  }

  private goalSeekBrent(
    setCell: CellPosition,
    toValue: number,
    byChangingCell: CellPosition,
    epsilon: number,
    minValue?: number,
    maxValue?: number
  ) {
    // Reuse BinarySearch logic to find bracket if we start heuristic, OR improve bracket finding for Brent
    // Simplest: Use the same bracket logic as binary search, then proceed

    const startValue = this.getters.getEvaluatedCell(byChangingCell).value;
    let center = typeof startValue === "number" ? startValue : parseFloat(String(startValue)) || 0;
    if (minValue !== undefined) center = Math.max(center, minValue);
    if (maxValue !== undefined) center = Math.min(center, maxValue);

    // Initial bracket points
    let a: number, b: number;

    // Heuristic expansion similar to Binary Search to find [a, b] where sign changes
    // We cannot just pick a+1 blindly if bounded.

    let low = center;
    let high = center;
    let step = 1;
    let foundBracket = false;

    // Check center first
    const yCenter = this.evaluateAt(setCell, byChangingCell, center);
    if (Math.abs(yCenter - toValue) < epsilon) return;

    // Check direction
    // If center is at bounds, we can only check one side.
    let checkStep = 1;
    if (center >= (maxValue ?? Infinity)) checkStep = -1;
    else if (center <= (minValue ?? -Infinity)) checkStep = 1;

    const yPlus = this.evaluateAt(setCell, byChangingCell, center + checkStep);
    let increasing = yPlus > yCenter;
    if (checkStep < 0) increasing = !increasing;

    const goRight = (increasing && yCenter < toValue) || (!increasing && yCenter > toValue);

    let iter = 0;
    if (goRight) {
      // Search UP for b
      b = center;
      a = center; // a will trail or stay? Brent needs sign change.
      // Let's just find [low, high] with sign change like binary search
      while (iter < 20) {
        high += step;
        if (maxValue !== undefined && high > maxValue) {
          high = maxValue;
          step = 0;
        }
        const y = this.evaluateAt(setCell, byChangingCell, high);
        if ((increasing && y >= toValue) || (!increasing && y <= toValue)) {
          foundBracket = true;
          break;
        }
        if (maxValue !== undefined && high >= maxValue) break;
        step *= 2;
        iter++;
      }
    } else {
      // Search DOWN
      while (iter < 20) {
        low -= step;
        if (minValue !== undefined && low < minValue) {
          low = minValue;
          step = 0;
        }
        const y = this.evaluateAt(setCell, byChangingCell, low);
        if ((increasing && y <= toValue) || (!increasing && y >= toValue)) {
          foundBracket = true;
          break;
        }
        if (minValue !== undefined && low <= minValue) break;
        step *= 2;
        iter++;
      }
    }

    if (!foundBracket) {
      this.updateCell(byChangingCell, (low + high) / 2);
      return;
    }

    // Setup Brent variables
    a = low;
    b = high;

    let fa = this.evaluateAt(setCell, byChangingCell, a) - toValue;
    let fb = this.evaluateAt(setCell, byChangingCell, b) - toValue;

    if (Math.abs(fa) < epsilon) {
      this.updateCell(byChangingCell, a);
      return;
    }
    if (Math.abs(fb) < epsilon) {
      this.updateCell(byChangingCell, b);
      return;
    }

    if (Math.abs(fa) < Math.abs(fb)) {
      let temp = a;
      a = b;
      b = temp;
      temp = fa;
      fa = fb;
      fb = temp;
    }

    let c = a;
    let fc = fa;
    let s = b;
    let d = b - a; // used for step size check
    let mflag = true;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      if (Math.abs(fb) < epsilon || Math.abs(b - a) < epsilon) {
        this.updateCell(byChangingCell, b);
        return;
      }

      // Inverse quadratic interpolation
      if (fa !== fc && fb !== fc) {
        s =
          (a * fb * fc) / ((fa - fb) * (fa - fc)) +
          (b * fa * fc) / ((fb - fa) * (fb - fc)) +
          (c * fa * fb) / ((fc - fa) * (fc - fb));
      } else {
        // Secant method
        s = b - (fb * (b - a)) / (fb - fa);
      }

      // Check bounds for s? Brent is bracketing, so s should naturally be effectively bounded if [a,b] is within bounds.
      // But let's be safe.
      if (minValue !== undefined) s = Math.max(s, minValue);
      if (maxValue !== undefined) s = Math.min(s, maxValue);

      // Conditions to force bisection
      const condition1 = (s < (3 * a + b) / 4 && s < b) || (s > (3 * a + b) / 4 && s > b);
      const condition2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
      const condition3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;

      if (condition1 || condition2 || condition3) {
        s = (a + b) / 2;
        mflag = true;
      } else {
        mflag = false;
      }

      const fs = this.evaluateAt(setCell, byChangingCell, s) - toValue;
      d = c;
      c = b;
      fc = fb;

      if (fa * fs < 0) {
        b = s;
        fb = fs;
      } else {
        a = s;
        fa = fs;
      }

      if (Math.abs(fa) < Math.abs(fb)) {
        let temp = a;
        a = b;
        b = temp;
        temp = fa;
        fa = fb;
        fb = temp;
      }
    }
    this.updateCell(byChangingCell, b);
  }

  private evaluateAt(setCell: CellPosition, byChangingCell: CellPosition, value: number): number {
    this.updateCell(byChangingCell, value);
    const result = this.getters.getEvaluatedCell(setCell).value;
    return typeof result === "number" ? result : parseFloat(String(result)) || 0;
  }

  private updateCell(position: CellPosition, value: number) {
    this.model.dispatch("UPDATE_CELL", {
      col: position.col,
      row: position.row,
      sheetId: position.sheetId,
      content: value.toString(),
    });
  }

  handle(cmd: Command) {}
}
