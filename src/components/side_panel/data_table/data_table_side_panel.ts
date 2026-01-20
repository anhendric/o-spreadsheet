import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component, useState } from "@odoo/owl";
import { SelectionInput } from "../../selection_input/selection_input";
import { Section } from "../components/section/section";

interface Props {
  onCloseSidePanel: () => void;
}

export class DataTableSidePanel extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-DataTableSidePanel";
  static components = { SelectionInput, Section };
  static props = {
    onCloseSidePanel: Function,
  };

  private state!: {
    rowInput: string;
    colInput: string;
    isInvalid: boolean;
  };

  setup() {
    this.state = useState({
      rowInput: "",
      colInput: "",
      isInvalid: false,
    });
  }

  onRowInputChanged(ranges: string[]) {
    this.state.rowInput = ranges[0] || "";
  }

  onColInputChanged(ranges: string[]) {
    this.state.colInput = ranges[0] || "";
  }

  async fillTable() {
    const rowInput = this.state.rowInput;
    const colInput = this.state.colInput;

    // Validation: At least one input, and a selection exists
    const zones = this.env.model.getters.getSelectedZones();
    if (zones.length === 0 || (!rowInput && !colInput)) {
      this.state.isInvalid = true;
      return;
    }

    const selection = zones[0]; // Operate on primary selection
    const sheetId = this.env.model.getters.getActiveSheetId();

    // Snapshot original input values
    let originalRowVal: string | undefined;
    let originalColVal: string | undefined;

    if (rowInput) {
      const range = this.env.model.getters.getRangeFromSheetXC(sheetId, rowInput);
      if (range) {
        const cell = this.env.model.getters.getCell({
          sheetId,
          col: range.zone.left,
          row: range.zone.top,
        });
        originalRowVal = cell ? cell.content : "";
      }
    }
    if (colInput) {
      const range = this.env.model.getters.getRangeFromSheetXC(sheetId, colInput);
      if (range) {
        const cell = this.env.model.getters.getCell({
          sheetId,
          col: range.zone.left,
          row: range.zone.top,
        });
        originalColVal = cell ? cell.content : "";
      }
    }

    // Determine Mode
    const isTwoVariable = !!(rowInput && colInput);

    // Prepare Results Map: key="col,row", value="result"
    const results: { col: number; row: number; val: string }[] = [];

    // Logic based on Excel Data Table
    // 1. Two Variable:
    //    - Formula is at selection.top, selection.left
    //    - Row Values: selection.top, form left+1 to right
    //    - Col Values: selection.left, from top+1 to bottom
    //    - Table Body: [left+1, top+1] to [right, bottom]

    // 2. One Variable (Column Oriented / Input is COL Input Cell):
    //    - Values are in Left Column of selection.
    //    - Formulas are in Top Row of selection.
    //    - Fill selection excluding top row and left col?
    //    - Excel: Selection includes the formula(s) and the input values.
    //      If Input is Column Input (values in column): Formulas are in the row *adjacent*?
    //      Usually selection is Rect.
    //      If Column Input: Values are in left-most column. Formulas in top row.
    //      If Row Input: Values in top-most row. Formulas in left column.

    const startRow = selection.top;
    const endRow = selection.bottom;
    const startCol = selection.left;
    const endCol = selection.right;

    // Iterate
    // We need to loop carefully.
    // Evaluating can be slow. We will do it sequentially.

    // Helper to set cell
    const setCell = (xc: string, val: string) => {
      const range = this.env.model.getters.getRangeFromSheetXC(sheetId, xc);
      if (!range) return;
      this.env.model.dispatch("UPDATE_CELL", {
        sheetId,
        col: range.zone.left,
        row: range.zone.top,
        content: val,
      });
    };

    const getFormulaResult = (formulaCol: number, formulaRow: number): string => {
      const cell = (this.env.model.getters as any).getEvaluatedCell({
        sheetId,
        col: formulaCol,
        row: formulaRow,
      });
      return String(cell ? cell.value : "");
    };

    // 2-Variable Logic
    if (isTwoVariable) {
      // Formula at top-left (startCol, startRow)
      const formulaCol = startCol;
      const formulaRow = startRow;

      // Loop body
      for (let r = startRow + 1; r <= endRow; r++) {
        // Get Col Input Value from (startCol, r)
        const colValCell = this.env.model.getters.getCell({ sheetId, col: startCol, row: r });
        const colVal = colValCell?.content || ""; // Raw content usually

        for (let c = startCol + 1; c <= endCol; c++) {
          // Get Row Input Value from (c, startRow)
          const rowValCell = this.env.model.getters.getCell({ sheetId, col: c, row: startRow });
          const rowVal = rowValCell?.content || "";

          // 1. Set Inputs
          setCell(colInput, colVal); // Set row val to col inputs?? No.
          // Col Input Cell gets values from Left Column.
          setCell(colInput, colVal);
          // Row Input Cell gets values from Top Row.
          setCell(rowInput, rowVal);

          // 2. Wait for Eval (Implicit? Dispatch is sync? Check.)
          // 3. Read Result from Formula Cell
          const result = getFormulaResult(formulaCol, formulaRow);

          results.push({ col: c, row: r, val: result });
        }
      }
    } else if (rowInput) {
      // One Variable (Row Input Cell) -> Values are in a ROW (Top Row)
      // Formulas are in Left Column (startCol)
      // Wait, Row Input Cell -> Substitution values are in the ROW.
      // Formulas should be in the COLUMN (Left)?
      // Correct for Row-Oriented table.

      // Loop inputs (Top Row, startCol+1 to endCol)
      for (let c = startCol + 1; c <= endCol; c++) {
        const rowValCell = this.env.model.getters.getCell({ sheetId, col: c, row: startRow });
        const rowVal = rowValCell?.content || "";
        setCell(rowInput, rowVal);

        // Calculate references (Formulas in Left Column)
        for (let r = startRow + 1; r <= endRow; r++) {
          // Formula at (startCol, r)
          const res = getFormulaResult(startCol, r);
          results.push({ col: c, row: r, val: res });
        }
      }
    } else {
      // One Variable (Column Input Cell) -> Values are in a COLUMN (Left Col)
      // Formulas are in Top Row

      // Loop inputs (Left Col, startRow+1 to endRow)
      for (let r = startRow + 1; r <= endRow; r++) {
        const colValCell = this.env.model.getters.getCell({ sheetId, col: startCol, row: r });
        const colVal = colValCell?.content || "";
        setCell(colInput, colVal); // Set Col Input Cell to value from Left Col

        // Calculate references (Formulas in Top Row)
        for (let c = startCol + 1; c <= endCol; c++) {
          const res = getFormulaResult(c, startRow);
          results.push({ col: c, row: r, val: res });
        }
      }
    }

    // Restore Originals
    if (rowInput && originalRowVal !== undefined) setCell(rowInput, originalRowVal);
    if (colInput && originalColVal !== undefined) setCell(colInput, originalColVal);

    // Commit Results
    for (const res of results) {
      this.env.model.dispatch("UPDATE_CELL", {
        sheetId,
        col: res.col,
        row: res.row,
        content: res.val,
      });
    }

    this.props.onCloseSidePanel();
  }
}
