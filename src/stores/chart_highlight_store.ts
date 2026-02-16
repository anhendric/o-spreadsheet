import { ChartWithDataSetDefinition, Highlight } from "../types";
import { HighlightStore } from "./highlight_store";
import { SpreadsheetStore } from "./spreadsheet_store";

export class ChartHighlightStore extends SpreadsheetStore {
  mutators = ["toggleHighlights"] as const;

  private isVisible: boolean = false;

  setup() {
    this.get(HighlightStore).register(this);
  }

  toggleHighlights() {
    this.isVisible = !this.isVisible;
  }

  get highlights(): Highlight[] {
    if (!this.isVisible) {
      return [];
    }

    const selectedFigureId = this.getters.getSelectedFigureId();
    const chartId = selectedFigureId
      ? this.getters.getChartIdFromFigureId(selectedFigureId)
      : undefined;
    if (!chartId) {
      return [];
    }

    const definition = this.getters.getChartDefinition(chartId);
    const figureId = this.getters.getFigureIdFromChartId(chartId);
    const sheetId = this.getters.getFigureSheetId(figureId);

    if (!sheetId || !("dataSets" in definition)) {
      return [];
    }

    const highlights: Highlight[] = [];
    const chartDefinition = definition as ChartWithDataSetDefinition;

    // Data sets
    for (const ds of chartDefinition.dataSets) {
      const range = this.getters.getRangeFromSheetXC(sheetId, ds.dataRange);
      highlights.push({
        range,
        color: ds.backgroundColor || "#4285f4",
        noFill: true,
      });
    }

    // Label range
    if (chartDefinition.labelRange) {
      const range = this.getters.getRangeFromSheetXC(sheetId, chartDefinition.labelRange);
      highlights.push({
        range,
        color: "#f4b400",
        noFill: true,
      });
    }

    return highlights;
  }
}
