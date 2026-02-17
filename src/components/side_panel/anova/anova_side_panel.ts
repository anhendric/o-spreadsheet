import { _t } from "@odoo/o-spreadsheet-engine/translation";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component, useState } from "@odoo/owl";
import { SelectionInput } from "../../selection_input/selection_input";
import { AnovaResult, calculateOneWayAnova } from "./anova_statistics";

interface Props {
  onCloseSidePanel: () => void;
}

interface State {
  type: "SingleFactor" | "TwoFactorRep" | "TwoFactorNoRep";
  inputRange: string;
  groupedBy: "columns" | "rows";
  labelsInFirstRow: boolean;
  alpha: number;
  rowsPerSample: number;
  outputRange: string;
  newSheet: string; // "true" or "false" (radio model)
  error: string;
}

export class AnovaSidePanel extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-AnovaSidePanel";
  static components = { SelectionInput };
  static props = {
    onCloseSidePanel: Function,
  };

  private state!: State;

  setup() {
    this.state = useState({
      type: "SingleFactor",
      inputRange: "",
      groupedBy: "columns",
      labelsInFirstRow: true,
      alpha: 0.05,
      rowsPerSample: 1,
      outputRange: "",
      newSheet: "true",
      error: "",
    });
  }

  onInputRangeChanged(ranges: string[]) {
    this.state.inputRange = ranges[0] || "";
  }

  onOutputRangeChanged(ranges: string[]) {
    this.state.outputRange = ranges[0] || "";
  }

  async compute() {
    this.state.error = "";
    if (!this.state.inputRange) {
      this.state.error = _t("Please select an input range.");
      return;
    }

    if (this.state.newSheet === "false" && !this.state.outputRange) {
      this.state.error = _t("Please select an output range.");
      return;
    }

    try {
      if (this.state.type === "SingleFactor") {
        await this.computeOneWay();
      } else {
        this.state.error = _t("Only Single Factor ANOVA is currently implemented.");
      }
    } catch (e) {
      this.state.error = (e as any).message || String(e);
    }
  }

  async computeOneWay() {
    const sheetId = this.env.model.getters.getActiveSheetId();
    const range = this.env.model.getters.getRangeFromSheetXC(sheetId, this.state.inputRange);
    if (!range) throw new Error(_t("Invalid input range"));

    const zone = range.zone;
    const data: number[][] = [];
    const groupNames: string[] = [];

    // Read Data
    if (this.state.groupedBy === "columns") {
      const startRow = this.state.labelsInFirstRow ? zone.top + 1 : zone.top;
      for (let col = zone.left; col <= zone.right; col++) {
        const colData: number[] = [];
        // Get Label
        if (this.state.labelsInFirstRow) {
          const cell = this.env.model.getters.getEvaluatedCell({ sheetId, col, row: zone.top });
          groupNames.push(cell.value ? String(cell.value) : `Column ${col + 1}`);
        } else {
          groupNames.push(`Column ${col + 1}`);
        }

        // Get Values
        for (let row = startRow; row <= zone.bottom; row++) {
          const cell = this.env.model.getters.getEvaluatedCell({ sheetId, col, row });
          if (cell.type === "number") {
            colData.push(cell.value as number);
          }
        }
        data.push(colData);
      }
    } else {
      const startCol = this.state.labelsInFirstRow ? zone.left + 1 : zone.left;
      for (let row = zone.top; row <= zone.bottom; row++) {
        const rowData: number[] = [];
        // Get Label
        if (this.state.labelsInFirstRow) {
          const cell = this.env.model.getters.getEvaluatedCell({ sheetId, col: zone.left, row });
          groupNames.push(cell.value ? String(cell.value) : `Row ${row + 1}`);
        } else {
          groupNames.push(`Row ${row + 1}`);
        }

        // Get Values
        for (let col = startCol; col <= zone.right; col++) {
          const cell = this.env.model.getters.getEvaluatedCell({ sheetId, col, row });
          if (cell.type === "number") {
            rowData.push(cell.value as number);
          }
        }
        data.push(rowData);
      }
    }

    const result = calculateOneWayAnova(data, groupNames, this.state.alpha);
    await this.writeResult(result);
  }

  async writeResult(result: AnovaResult) {
    let targetSheetId: string;
    let targetCol: number;
    let targetRow: number;

    if (this.state.newSheet === "true") {
      targetSheetId = this.env.model.uuidGenerator.uuidv4();
      await this.env.model.dispatch("CREATE_SHEET", {
        sheetId: targetSheetId,
        name: "ANOVA Result",
        position: this.env.model.getters.getVisibleSheetIds().length,
      });
      await this.env.model.dispatch("ACTIVATE_SHEET", {
        sheetIdFrom: this.env.model.getters.getActiveSheetId(),
        sheetIdTo: targetSheetId,
      });
      targetCol = 0;
      targetRow = 0;
    } else {
      const range = this.env.model.getters.getRangeFromSheetXC(
        this.env.model.getters.getActiveSheetId(),
        this.state.outputRange
      );
      if (!range) throw new Error(_t("Invalid output range"));
      targetSheetId = range.sheetId;
      targetCol = range.zone.left;
      targetRow = range.zone.top;
    }

    const setCell = (col: number, row: number, value: string | number) => {
      this.env.model.dispatch("UPDATE_CELL", {
        sheetId: targetSheetId,
        col,
        row,
        content: String(value),
      });
    };

    const bold = (col: number, row: number) => {
      this.env.model.dispatch("UPDATE_CELL", {
        sheetId: targetSheetId,
        col,
        row,
        style: { bold: true },
      });
    };

    let r = targetRow;
    const c = targetCol;

    // Title
    setCell(c, r, "Anova: Single Factor");
    bold(c, r);
    r++;
    r++; // skip line

    // SUMMARY Table
    setCell(c, r, "SUMMARY");
    bold(c, r);
    r++;
    const summaryHeaders = ["Groups", "Count", "Sum", "Average", "Variance"];
    summaryHeaders.forEach((h, i) => {
      setCell(c + i, r, h);
      bold(c + i, r);
    });
    r++;

    for (let i = 0; i < result.summary.groups.length; i++) {
      setCell(c, r, result.summary.groups[i]);
      setCell(c + 1, r, result.summary.count[i]);
      setCell(c + 2, r, result.summary.sum[i]);
      setCell(c + 3, r, result.summary.average[i]);
      setCell(c + 4, r, result.summary.variance[i]);
      r++;
    }
    r++; // skip line

    // ANOVA Table
    setCell(c, r, "ANOVA");
    bold(c, r);
    r++;
    const anovaHeaders = ["Source of Variation", "SS", "df", "MS", "F", "P-value", "F crit"];
    anovaHeaders.forEach((h, i) => {
      setCell(c + i, r, h);
      bold(c + i, r);
    });
    r++;

    for (let i = 0; i < result.anova.source.length; i++) {
      setCell(c, r, result.anova.source[i]);
      setCell(c + 1, r, result.anova.ss[i]);
      setCell(c + 2, r, result.anova.df[i]);
      if (!isNaN(result.anova.ms[i])) setCell(c + 3, r, result.anova.ms[i]);
      if (!isNaN(result.anova.f[i])) setCell(c + 4, r, result.anova.f[i]);
      if (!isNaN(result.anova.pValue[i])) setCell(c + 5, r, result.anova.pValue[i]);
      if (!isNaN(result.anova.fCrit[i])) setCell(c + 6, r, result.anova.fCrit[i]);
      r++;
    }

    this.props.onCloseSidePanel();
  }
}
