import { _t } from "@odoo/o-spreadsheet-engine/translation";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { MainChartPanelStore } from "../components/side_panel/chart/main_chart_panel/main_chart_panel_store";
import { ChartHighlightStore } from "../stores/chart_highlight_store";
import { Color, UID } from "../types";
import { ActionSpec } from "./action";

// --- Helpers ---

export function getSelectedChartId(env: SpreadsheetChildEnv): UID | undefined {
  const figureId = env.model.getters.getSelectedFigureId();
  if (!figureId) {
    return undefined;
  }
  return env.model.getters.getChartIdFromFigureId(figureId);
}

export function updateSelectedChart(env: SpreadsheetChildEnv, update: any) {
  const chartId = getSelectedChartId(env);
  if (!chartId) return;
  const figureId = env.model.getters.getFigureIdFromChartId(chartId);
  const definition = {
    ...env.model.getters.getChartDefinition(chartId),
    ...update,
  };
  env.model.dispatch("UPDATE_CHART", {
    definition,
    chartId,
    figureId,
    sheetId: env.model.getters.getFigureSheetId(figureId)!,
  });
}

// --- Actions ---

export const changeChartType = (type: string) => (env: SpreadsheetChildEnv) => {
  const chartId = getSelectedChartId(env);
  if (!chartId) return;
  env.getStore(MainChartPanelStore).changeChartType(chartId, type);
};

export const setChartColumn: ActionSpec = {
  name: _t("Column"),
  icon: "o-spreadsheet-Icon.CHART_COLUMN",
  execute: changeChartType("column"),
};

export const setChartLine: ActionSpec = {
  name: _t("Line"),
  icon: "o-spreadsheet-Icon.CHART_LINE",
  execute: changeChartType("line"),
};

export const setChartPie: ActionSpec = {
  name: _t("Pie"),
  icon: "o-spreadsheet-Icon.CHART_PIE",
  execute: changeChartType("pie"),
};

export const setChartDoughnut: ActionSpec = {
  name: _t("Doughnut"),
  icon: "o-spreadsheet-Icon.CHART_DOUGHNUT",
  execute: changeChartType("doughnut"),
};

export const setChartScorecard: ActionSpec = {
  name: _t("Scorecard"),
  icon: "o-spreadsheet-Icon.CHART_SCORECARD",
  execute: changeChartType("scorecard"),
};

export const chartTypeMenu: ActionSpec = {
  name: _t("Chart Type"),
  icon: "o-spreadsheet-Icon.CHART_COLUMN",
  children: [setChartColumn, setChartLine, setChartPie, setChartDoughnut, setChartScorecard],
};

export const setLegendTop: ActionSpec = {
  name: _t("Top"),
  execute: (env) => updateSelectedChart(env, { legendPosition: "top" }),
};

export const setLegendBottom: ActionSpec = {
  name: _t("Bottom"),
  execute: (env) => updateSelectedChart(env, { legendPosition: "bottom" }),
};

export const setLegendLeft: ActionSpec = {
  name: _t("Left"),
  execute: (env) => updateSelectedChart(env, { legendPosition: "left" }),
};

export const setLegendRight: ActionSpec = {
  name: _t("Right"),
  execute: (env) => updateSelectedChart(env, { legendPosition: "right" }),
};

export const setLegendNone: ActionSpec = {
  name: _t("None"),
  execute: (env) => updateSelectedChart(env, { legendPosition: "none" }),
};

export const legendPositionMenu: ActionSpec = {
  name: _t("Legend Position"),
  icon: "o-spreadsheet-Icon.CHART_LEGEND",
  children: [setLegendTop, setLegendBottom, setLegendLeft, setLegendRight, setLegendNone],
};

export const toggleShowValues: ActionSpec = {
  name: _t("Show values"),
  execute: (env) => {
    const chartId = getSelectedChartId(env);
    if (!chartId) return;
    const definition = env.model.getters.getChartDefinition(chartId) as any;
    updateSelectedChart(env, { showValues: !definition.showValues });
  },
  isActive: (env) => {
    const chartId = getSelectedChartId(env);
    if (!chartId) return false;
    const definition = env.model.getters.getChartDefinition(chartId) as any;
    return !!definition.showValues;
  },
};

export const toggleHumanize: ActionSpec = {
  name: _t("Humanize number"),
  execute: (env) => {
    const chartId = getSelectedChartId(env);
    if (!chartId) return;
    const definition = env.model.getters.getChartDefinition(chartId) as any;
    updateSelectedChart(env, { humanize: !definition.humanize });
  },
  isActive: (env) => {
    const chartId = getSelectedChartId(env);
    if (!chartId) return false;
    const definition = env.model.getters.getChartDefinition(chartId) as any;
    return definition.humanize !== false; // default true
  },
};

export const toggleViewRange: ActionSpec = {
  name: _t("View range"),
  execute: (env) => {
    env.getStore(ChartHighlightStore).toggleHighlights();
  },
};

export const setChartBackgroundColor = (color: Color) => (env: SpreadsheetChildEnv) => {
  updateSelectedChart(env, { background: color });
};
