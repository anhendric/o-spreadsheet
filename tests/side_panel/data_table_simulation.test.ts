import { Model } from "../../src";
import { setCellContent } from "../test_helpers/commands_helpers";
import { getCellContent } from "../test_helpers/getters_helpers";

describe("Data Table Simulation", () => {
  let model: Model;

  beforeEach(() => {
    model = new Model();
  });

  // Helper to simulate Data Table Logic (replicates SidePanel logic)
  const simulateDataTable = (
    model: Model,
    rangeXc: string,
    rowInput: string | null,
    colInput: string | null
  ) => {
    const sheetId = model.getters.getActiveSheetId();
    const range = model.getters.getRangeFromSheetXC(sheetId, rangeXc);
    if (!range) throw new Error("Invalid range");
    const selection = range.zone;

    const startRow = selection.top;
    const endRow = selection.bottom;
    const startCol = selection.left;
    const endCol = selection.right;

    const isTwoVariable = !!(rowInput && colInput);
    const results: { col: number; row: number; val: string }[] = [];

    // Snapshot
    const originalRowVal = rowInput ? getCellContent(model, rowInput) : "";
    const originalColVal = colInput ? getCellContent(model, colInput) : "";

    const setCell = (xc: string, val: string) => {
      const r = model.getters.getRangeFromSheetXC(sheetId, xc);
      model.dispatch("UPDATE_CELL", { sheetId, col: r!.zone.left, row: r!.zone.top, content: val });
    };

    const getFormulaResult = (c: number, r: number) => {
      // Use getEvaluatedCell for computed values
      const cell = (model.getters as any).getEvaluatedCell({ sheetId, col: c, row: r });
      return String(cell ? cell.value : "");
    };

    if (isTwoVariable) {
      const formulaCol = startCol;
      const formulaRow = startRow;
      for (let r = startRow + 1; r <= endRow; r++) {
        const colValCell = model.getters.getCell({ sheetId, col: startCol, row: r });
        const colVal = colValCell?.content || "";
        for (let c = startCol + 1; c <= endCol; c++) {
          const rowValCell = model.getters.getCell({ sheetId, col: c, row: startRow });
          const rowVal = rowValCell?.content || "";
          setCell(colInput!, colVal);
          setCell(rowInput!, rowVal);
          results.push({ col: c, row: r, val: getFormulaResult(formulaCol, formulaRow) });
        }
      }
    } else if (rowInput) {
      for (let c = startCol + 1; c <= endCol; c++) {
        const rowValCell = model.getters.getCell({ sheetId, col: c, row: startRow });
        const rowVal = rowValCell?.content || "";
        setCell(rowInput, rowVal);
        for (let r = startRow + 1; r <= endRow; r++) {
          results.push({ col: c, row: r, val: getFormulaResult(startCol, r) });
        }
      }
    } else if (colInput) {
      for (let r = startRow + 1; r <= endRow; r++) {
        const colValCell = model.getters.getCell({ sheetId, col: startCol, row: r });
        const colVal = colValCell?.content || "";
        setCell(colInput, colVal);
        for (let c = startCol + 1; c <= endCol; c++) {
          results.push({ col: c, row: r, val: getFormulaResult(c, startRow) });
        }
      }
    }

    // Restore
    if (rowInput) setCell(rowInput, originalRowVal);
    if (colInput) setCell(colInput, originalColVal);

    // Commit
    for (const res of results) {
      model.dispatch("UPDATE_CELL", { sheetId, col: res.col, row: res.row, content: res.val });
    }
  };

  test("1-Variable Data Table (Column Input)", () => {
    setCellContent(model, "C1", "5");
    setCellContent(model, "B1", "=C1*2");
    setCellContent(model, "A2", "10");
    setCellContent(model, "A3", "20");
    setCellContent(model, "A4", "30");

    simulateDataTable(model, "A1:B4", null, "C1");

    expect(getCellContent(model, "B2")).toBe("20");
    expect(getCellContent(model, "B3")).toBe("40");
    expect(getCellContent(model, "B4")).toBe("60");
    expect(getCellContent(model, "C1")).toBe("5");
  });

  test("2-Variable Data Table", () => {
    setCellContent(model, "E1", "0");
    setCellContent(model, "E2", "0");
    setCellContent(model, "A1", "=E1+E2");

    setCellContent(model, "B1", "1");
    setCellContent(model, "C1", "2");
    setCellContent(model, "D1", "3");

    setCellContent(model, "A2", "10");
    setCellContent(model, "A3", "20");
    setCellContent(model, "A4", "30");

    simulateDataTable(model, "A1:D4", "E1", "E2");

    // B2 (R=1, C=10) -> 11
    expect(getCellContent(model, "B2")).toBe("11");
    // B3 (R=1, C=20) -> 21
    expect(getCellContent(model, "B3")).toBe("21");
    // D4 (R=3, C=30) -> 33
    expect(getCellContent(model, "D4")).toBe("33");
  });
});
