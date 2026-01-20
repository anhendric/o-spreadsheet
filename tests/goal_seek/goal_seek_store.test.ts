import { Model } from "../../src";
import { GoalSeekStore } from "../../src/components/side_panel/goal_seek/goal_seek_store";
import { setCellContent } from "../test_helpers/commands_helpers";
import { getCellContent } from "../test_helpers/getters_helpers";
import { makeStore } from "../test_helpers/stores";

let model: Model;
let store: GoalSeekStore;

beforeEach(() => {
  ({ store, model } = makeStore(GoalSeekStore));
});

describe("Goal Seek", () => {
  describe("Secant Method", () => {
    test("Simple linear equation", () => {
      setCellContent(model, "A1", "=2*B1");
      setCellContent(model, "B1", "0");

      store.goalSeek(
        { sheetId: model.getters.getActiveSheetId(), col: 0, row: 0 }, // A1
        10,
        { sheetId: model.getters.getActiveSheetId(), col: 1, row: 0 }, // B1
        "Secant",
        1e-7
      );

      expect(Number(getCellContent(model, "B1"))).toBeCloseTo(5);
      expect(Number(getCellContent(model, "A1"))).toBeCloseTo(10);
    });
  });

  describe("Binary Search Method", () => {
    test("Bounded Binary Search", () => {
      // A1 = B1
      setCellContent(model, "A1", "=B1");
      setCellContent(model, "B1", "0");

      // Goal: 50. Bounds: [0, 100]
      store.goalSeek(
        { sheetId: model.getters.getActiveSheetId(), col: 0, row: 0 }, // A1
        50,
        { sheetId: model.getters.getActiveSheetId(), col: 1, row: 0 }, // B1
        "BinarySearch",
        1e-7,
        0,
        100
      );

      expect(Number(getCellContent(model, "B1"))).toBeCloseTo(50);
    });

    test("Binary Search Constrained by Bounds (Root Outside)", () => {
      // A1 = B1
      setCellContent(model, "A1", "=B1");
      setCellContent(model, "B1", "0");

      // Goal: 150. Bounds: [0, 100]. Should saturate at 100.
      store.goalSeek(
        { sheetId: model.getters.getActiveSheetId(), col: 0, row: 0 }, // A1
        150,
        { sheetId: model.getters.getActiveSheetId(), col: 1, row: 0 }, // B1
        "BinarySearch",
        1e-7,
        0,
        100
      );

      // Ideally it stops at 100 because it can't go higher
      expect(Number(getCellContent(model, "B1"))).toBeCloseTo(100);
    });
  });

  describe("Secant Method with Bounds", () => {
    test("Secant Clamped to Bounds", () => {
      // A1 = B1
      setCellContent(model, "A1", "=B1");
      setCellContent(model, "B1", "0");

      // Goal: 150. Max: 100.
      store.goalSeek(
        { sheetId: model.getters.getActiveSheetId(), col: 0, row: 0 }, // A1
        150,
        { sheetId: model.getters.getActiveSheetId(), col: 1, row: 0 }, // B1
        "Secant",
        1e-7,
        0,
        100
      );
      expect(Number(getCellContent(model, "B1"))).toBeCloseTo(100);
    });
  });
});
