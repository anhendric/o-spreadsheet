import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component, useState } from "@odoo/owl";
import { SelectionInput } from "../../selection_input/selection_input";
import { SidePanelCollapsible } from "../components/collapsible/side_panel_collapsible";
import { Section } from "../components/section/section";

interface Constraint {
  param: string;
  op: "<=" | "=" | ">=" | "int" | "bin";
  value: string;
}

interface GenericSolverConfig {
  objectiveCell: string | string[];
  goal: "max" | "min" | "value";
  targetValue: string;
  changingCells: string[];
  constraints: Constraint[];
  algorithm: "Nelder-Mead" | "BFGS" | "Genetic" | "Gradient Descent" | "PSO" | "SPEA2" | "NSGA-II";
  settings: {
    maxIter: number;
    tol: number;
    popSize: number;
    mutationRate: number;
    crossoverRate: number;
    inertia: number;
    c1: number;
    c2: number;
    domain: { xc: string; min?: number; max?: number }[];
    recordingSheet: boolean;
  };
}

interface Props {
  onCloseSidePanel: () => void;
}

export class SolverSidePanel extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-SolverSidePanel";
  static components = { SelectionInput, Section, SidePanelCollapsible };
  static props = {
    onCloseSidePanel: Function,
  };

  private state!: {
    objectiveCell: string | string[];
    goal: "max" | "min" | "value";
    targetValue: string;
    changingCells: string[];
    constraints: Constraint[];
    algorithm:
      | "Nelder-Mead"
      | "BFGS"
      | "Genetic"
      | "Gradient Descent"
      | "PSO"
      | "SPEA2"
      | "NSGA-II";
    maxIter: number;
    tol: number;
    popSize: number;
    mutationRate: number;
    crossoverRate: number;
    inertia: number;
    c1: number;
    c2: number;

    isAddingConstraint: boolean;
    newConstraint: Constraint;

    isAddingBound: boolean;
    newBound: { xc: string; min?: number; max?: number };
    domain: { xc: string; min?: number; max?: number }[];
    recordingSheet: boolean;
  };

  setup() {
    this.state = useState({
      objectiveCell: "",
      goal: "max",
      targetValue: "0",
      changingCells: [],
      constraints: [],
      algorithm: "Nelder-Mead",
      maxIter: 10000,
      tol: 1e-6,
      popSize: 50,
      mutationRate: 0.1,
      crossoverRate: 0.8,
      inertia: 0.729,
      c1: 1.494,
      c2: 1.494,
      domain: [],
      isAddingConstraint: false,
      newConstraint: { param: "", op: "<=", value: "" },
      isAddingBound: false,
      newBound: { xc: "" },
      recordingSheet: false,
    });
  }

  // ... (keep change handlers)

  onObjectiveCellChanged(ranges: string[]) {
    // If 1 range, keep string (backward compat), if >1 or specifically multi-obj, store array?
    // Actually SelectionInput returns string[], but traditionally we grabbed [0].
    // Now if ranges.length > 1, we store string[].
    if (ranges.length === 1) this.state.objectiveCell = ranges[0];
    else this.state.objectiveCell = ranges;
  }

  onChangingCellsChanged(ranges: string[]) {
    this.state.changingCells = ranges;
  }

  onNewConstraintParamChanged(ranges: string[]) {
    this.state.newConstraint.param = ranges[0] || "";
  }

  openConstraintDialog() {
    this.state.newConstraint = { param: "", op: "<=", value: "" };
    this.state.isAddingConstraint = true;
  }

  cancelAddConstraint() {
    this.state.isAddingConstraint = false;
  }

  addConstraint() {
    if (this.state.newConstraint.param) {
      this.state.constraints.push({ ...this.state.newConstraint });
      this.state.isAddingConstraint = false;
    }
  }

  removeConstraint(index: number) {
    this.state.constraints.splice(index, 1);
  }

  onNewBoundXcChanged(ranges: string[]) {
    this.state.newBound.xc = ranges[0] || "";
  }

  openBoundDialog() {
    this.state.newBound = { xc: "" };
    this.state.isAddingBound = true;
  }

  cancelAddBound() {
    this.state.isAddingBound = false;
  }

  addBound() {
    if (this.state.newBound.xc) {
      this.state.domain.push({ ...this.state.newBound });
      this.state.isAddingBound = false;
    }
  }

  removeBound(index: number) {
    this.state.domain.splice(index, 1);
  }

  async solve() {
    if (!this.state.objectiveCell || this.state.changingCells.length === 0) return;

    const config: GenericSolverConfig = {
      objectiveCell: this.state.objectiveCell,
      goal: this.state.goal,
      targetValue: this.state.targetValue,
      changingCells: this.state.changingCells,
      constraints: this.state.constraints.map((c) => ({ ...c })),
      algorithm: this.state.algorithm,
      settings: {
        maxIter: this.state.maxIter,
        tol: this.state.tol,
        popSize: this.state.popSize,
        mutationRate: this.state.mutationRate,
        crossoverRate: this.state.crossoverRate,
        inertia: this.state.inertia,
        c1: this.state.c1,
        c2: this.state.c2,
        domain: this.state.domain,
        recordingSheet: this.state.recordingSheet,
      },
    };

    (this.env.model.dispatch as any)("SOLVER_SOLVE", config);
  }
}
