jest.mock("../src/helpers/text_helper", () => {
  const original = jest.requireActual("../src/helpers/text_helper");
  return {
    ...original,
    getCanvas: () => ({
      font: "",
      measureText: () => ({
        width: 10,
        fontBoundingBoxAscent: 10,
        fontBoundingBoxDescent: 2,
        actualBoundingBoxAscent: 10,
        actualBoundingBoxDescent: 2,
      }),
      getContext: () => ({
        font: "",
        measureText: () => ({
          width: 10,
          fontBoundingBoxAscent: 10,
          fontBoundingBoxDescent: 2,
          actualBoundingBoxAscent: 10,
          actualBoundingBoxDescent: 2,
        }),
      }),
      save: () => {},
      restore: () => {},
    }),
  };
});

import { Model } from "../src/model";

describe("JSON Serialization", () => {
  test("Can export and import a simple model as JSON", () => {
    const model = new Model();
    const sheetId = model.getters.getActiveSheetId();
    model.dispatch("UPDATE_CELL", { sheetId, col: 0, row: 0, content: "Hello JSON" }); // A1
    model.dispatch("UPDATE_CELL", { sheetId, col: 1, row: 1, content: "=1+1" }); // B2

    const exportedData = model.exportData();
    const jsonString = JSON.stringify(exportedData);
    const importedData = JSON.parse(jsonString);

    const newModel = new Model(importedData);

    const newSheetId = newModel.getters.getActiveSheetId();
    const cellA1 = newModel.getters.getCell({ sheetId: newSheetId, col: 0, row: 0 });
    const cellB2 = newModel.getters.getCell({ sheetId: newSheetId, col: 1, row: 1 });

    expect(cellA1?.content).toBe("Hello JSON");
    expect(cellB2?.content).toBe("=1+1");
  });

  test("Can export and import model with multiple sheets", () => {
    const model = new Model();
    const sheet1Id = model.getters.getActiveSheetId();
    const sheet2Id = "sheet2";
    model.dispatch("CREATE_SHEET", { sheetId: sheet2Id, position: 1, name: "Sheet2" });

    model.dispatch("UPDATE_CELL", { sheetId: sheet1Id, col: 0, row: 0, content: "Sheet1 Content" });
    model.dispatch("UPDATE_CELL", { sheetId: sheet2Id, col: 0, row: 0, content: "Sheet2 Content" });

    const exportedData = model.exportData();
    const newModel = new Model(exportedData);

    const cell1 = newModel.getters.getCell({ sheetId: sheet1Id, col: 0, row: 0 });
    expect(cell1?.content).toBe("Sheet1 Content");

    const cell2 = newModel.getters.getCell({ sheetId: sheet2Id, col: 0, row: 0 });
    expect(cell2?.content).toBe("Sheet2 Content");
  });

  test("Can export and import model with drawings and latex figures", () => {
    const model = new Model();
    const sheetId = model.getters.getActiveSheetId();

    // --- Latex Figure ---
    // 1. Create base figure
    const latexFigureId = "latex1";
    model.dispatch("CREATE_FIGURE", {
      sheetId,
      figureId: latexFigureId,
      tag: "latex",
      size: { width: 200, height: 100 },
      offset: { x: 50, y: 50 },
      col: 0,
      row: 0,
    });
    // 2. Set Latex content
    model.dispatch("UPDATE_LATEX_FIGURE", { figureId: latexFigureId, latex: "E=mc^2" });

    // --- Drawing Figure ---
    // 1. Create base figure
    const drawingFigureId = "drawing1";
    model.dispatch("CREATE_FIGURE", {
      sheetId,
      figureId: drawingFigureId,
      tag: "drawing",
      size: { width: 300, height: 200 },
      offset: { x: 300, y: 50 },
      col: 0,
      row: 0,
    });
    // 2. Initialize drawing data
    model.dispatch("CREATE_DRAWING_FIGURE", { figureId: drawingFigureId });
    // 3. Add an element to the drawing
    model.dispatch("ADD_DRAWING_ELEMENT", {
      figureId: drawingFigureId,
      element: {
        id: "elem1",
        type: "rect",
        x: 10,
        y: 10,
        width: 50,
        height: 50,
        style: { fillColor: "#FF0000" },
      },
    });

    // --- Export ---
    const exportedData = model.exportData();

    // --- Import ---
    const newModel = new Model(exportedData);

    // Verify Latex
    const latexContent = newModel.getters.getLatexContent(latexFigureId);
    expect(latexContent).toBe("E=mc^2");

    // Verify Drawing
    const drawing = newModel.getters.getDrawing(drawingFigureId);
    expect(drawing).toBeDefined();
    expect(drawing?.elements.length).toBe(1);
    expect(drawing?.elements[0].type).toBe("rect");
  });
});
