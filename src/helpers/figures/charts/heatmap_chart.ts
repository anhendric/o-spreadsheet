import { CoreGetters, RangeAdapterFunctions, Validator } from "@odoo/o-spreadsheet-engine";
import { DEFAULT_CHART_COLOR_SCALE } from "@odoo/o-spreadsheet-engine/constants";
import { AbstractChart } from "@odoo/o-spreadsheet-engine/helpers/figures/charts/abstract_chart";
import {
  checkDataset,
  createDataSets,
  duplicateDataSetsInDuplicatedSheet,
  transformChartDefinitionWithDataSetsWithZone,
  updateChartRangesWithDataSets,
} from "@odoo/o-spreadsheet-engine/helpers/figures/charts/chart_common";
import { CHART_COMMON_OPTIONS } from "@odoo/o-spreadsheet-engine/helpers/figures/charts/chart_ui_common";
import {
  AxesDesign,
  ChartColorScale,
  ChartCreationContext,
  ChartDefinition,
  ChartWithDataSetDefinition,
  CustomizedDataSet,
  ExcelChartDefinition,
  LegendPosition,
} from "@odoo/o-spreadsheet-engine/types/chart";
import { HeatmapChartDefinition } from "@odoo/o-spreadsheet-engine/types/chart/heatmap_chart";
import { MatrixChartDefinition } from "@odoo/o-spreadsheet-engine/types/chart/matrix_chart";
import { ChartConfiguration } from "chart.js";
import { Color, CommandResult, DataSet, Getters, RangeAdapter, UID } from "../../../types";
import { getMatrixChartTooltip } from "./runtime";
import { getChartDatasetValues, getTopPaddingForDashboard } from "./runtime/chart_data_extractor";
import { getMatrixChartDataset } from "./runtime/chartjs_dataset";
import { getMatrixChartLayout } from "./runtime/chartjs_layout";
import {
  getMatrixChartScales,
  getMatrixColorScale,
  getRuntimeColorScale,
} from "./runtime/chartjs_scales";
import { getChartTitle } from "./runtime/chartjs_title";

export class HeatmapChart extends AbstractChart {
  readonly dataSets: DataSet[];
  readonly verticalLabels?: DataSet;
  readonly horizontalLabels?: DataSet;
  readonly background?: Color;
  readonly type: any = "heatmap";
  readonly colorScale?: ChartColorScale;
  readonly axesDesign?: AxesDesign;
  readonly legendPosition: LegendPosition;
  readonly missingValueColor?: Color;
  readonly dataSetsHaveTitle: boolean;
  readonly interpolationType: "nearest" | "bilinear" | "bicubic" | "gaussian";

  constructor(definition: HeatmapChartDefinition, sheetId: UID, getters: CoreGetters) {
    super(definition as unknown as ChartDefinition, sheetId, getters);
    this.dataSets = createDataSets(
      getters,
      definition.dataSets,
      sheetId,
      definition.dataSetsHaveTitle
    );
    if (definition.verticalLabels) {
      this.verticalLabels = createDataSets(getters, [definition.verticalLabels], sheetId, false)[0];
    }
    if (definition.horizontalLabels) {
      this.horizontalLabels = createDataSets(
        getters,
        [definition.horizontalLabels],
        sheetId,
        false
      )[0];
    }
    this.background = definition.background;
    this.colorScale = definition.colorScale;
    this.axesDesign = definition.axesDesign;
    this.legendPosition = definition.legendPosition;
    this.missingValueColor = definition.missingValueColor;
    this.dataSetsHaveTitle = definition.dataSetsHaveTitle;
    this.interpolationType = definition.interpolationType || "bilinear";
  }

  static transformDefinition(
    chartSheetId: UID,
    definition: ChartDefinition,
    applyChange: RangeAdapter
  ): ChartDefinition {
    const heatmapDef = definition as unknown as HeatmapChartDefinition;
    const dataSetsValues = transformChartDefinitionWithDataSetsWithZone(
      chartSheetId,
      { ...definition, dataSets: heatmapDef.dataSets } as unknown as ChartWithDataSetDefinition,
      applyChange
    ) as unknown as HeatmapChartDefinition;

    let verticalLabels: CustomizedDataSet | undefined;
    if (heatmapDef.verticalLabels) {
      const verticalDef = transformChartDefinitionWithDataSetsWithZone(
        chartSheetId,
        {
          ...definition,
          dataSets: [heatmapDef.verticalLabels],
        } as unknown as ChartWithDataSetDefinition,
        applyChange
      ) as unknown as ChartWithDataSetDefinition;
      verticalLabels = verticalDef.dataSets[0];
    }

    let horizontalLabels: CustomizedDataSet | undefined;
    if (heatmapDef.horizontalLabels) {
      const horizontalDef = transformChartDefinitionWithDataSetsWithZone(
        chartSheetId,
        {
          ...definition,
          dataSets: [heatmapDef.horizontalLabels],
        } as unknown as ChartWithDataSetDefinition,
        applyChange
      ) as unknown as ChartWithDataSetDefinition;
      horizontalLabels = horizontalDef.dataSets[0];
    }

    return {
      ...dataSetsValues,
      verticalLabels,
      horizontalLabels,
    } as unknown as ChartDefinition;
  }

  static validateChartDefinition(
    validator: Validator,
    definition: ChartDefinition
  ): CommandResult | CommandResult[] {
    const result = validator.checkValidations(definition as any, checkDataset);
    return result;
  }

  static getDefinitionFromContextCreation(context: ChartCreationContext): ChartDefinition {
    let legendPosition: LegendPosition = "right";
    if (context.legendPosition === "left") {
      legendPosition = "left";
    }
    return {
      background: context.background,
      dataSets: context.range ?? [],
      dataSetsHaveTitle: context.dataSetsHaveTitle ?? false,
      title: context.title || { text: "" },
      type: "heatmap",
      axesDesign: context.axesDesign,
      legendPosition,
      interpolationType: "bilinear",
    } as unknown as ChartDefinition;
  }

  getContextCreation(): ChartCreationContext {
    const range: CustomizedDataSet[] = this.dataSets.map((dataSet) => ({
      dataRange: this.getters.getRangeString(dataSet.dataRange, this.sheetId),
    }));
    return {
      ...this,
      range,
    };
  }

  duplicateInDuplicatedSheet(newSheetId: UID): HeatmapChart {
    const dataSets = duplicateDataSetsInDuplicatedSheet(this.sheetId, newSheetId, this.dataSets);
    const verticalLabels = this.verticalLabels
      ? duplicateDataSetsInDuplicatedSheet(this.sheetId, newSheetId, [this.verticalLabels])[0]
      : undefined;
    const horizontalLabels = this.horizontalLabels
      ? duplicateDataSetsInDuplicatedSheet(this.sheetId, newSheetId, [this.horizontalLabels])[0]
      : undefined;

    const definition = this.getDefinitionWithSpecificDataSets(
      dataSets,
      verticalLabels,
      horizontalLabels,
      newSheetId
    );
    return new HeatmapChart(definition, newSheetId, this.getters);
  }

  copyInSheetId(sheetId: UID): HeatmapChart {
    const definition = this.getDefinitionWithSpecificDataSets(
      this.dataSets,
      this.verticalLabels,
      this.horizontalLabels,
      sheetId
    );
    return new HeatmapChart(definition, sheetId, this.getters);
  }

  getDefinition(): HeatmapChartDefinition {
    return this.getDefinitionWithSpecificDataSets(
      this.dataSets,
      this.verticalLabels,
      this.horizontalLabels
    );
  }

  private getDefinitionWithSpecificDataSets(
    dataSets: DataSet[],
    verticalLabels?: DataSet,
    horizontalLabels?: DataSet,
    targetSheetId?: UID
  ): HeatmapChartDefinition {
    const ranges: CustomizedDataSet[] = dataSets.map((dataSet) => ({
      dataRange: this.getters.getRangeString(dataSet.dataRange, targetSheetId || this.sheetId),
    }));
    const verticalLabelRange = verticalLabels
      ? {
          dataRange: this.getters.getRangeString(
            verticalLabels.dataRange,
            targetSheetId || this.sheetId
          ),
        }
      : undefined;
    const horizontalLabelRange = horizontalLabels
      ? {
          dataRange: this.getters.getRangeString(
            horizontalLabels.dataRange,
            targetSheetId || this.sheetId
          ),
        }
      : undefined;

    return {
      type: "heatmap",
      background: this.background,
      dataSets: ranges,
      verticalLabels: verticalLabelRange,
      horizontalLabels: horizontalLabelRange,
      dataSetsHaveTitle: dataSets.length ? Boolean(dataSets[0].labelCell) : false,
      title: this.title,
      colorScale: this.colorScale,
      axesDesign: this.axesDesign,
      legendPosition: this.legendPosition,
      missingValueColor: this.missingValueColor,
      interpolationType: this.interpolationType,
    };
  }

  getDefinitionForExcel(): ExcelChartDefinition | undefined {
    return undefined;
  }

  updateRanges({ applyChange }: RangeAdapterFunctions): HeatmapChart {
    const { dataSets, isStale } = updateChartRangesWithDataSets(
      this.getters,
      applyChange,
      this.dataSets,
      undefined
    );
    let verticalLabels = this.verticalLabels;
    let isVerticalStale = false;
    if (verticalLabels) {
      const result = updateChartRangesWithDataSets(
        this.getters,
        applyChange,
        [verticalLabels],
        undefined
      );
      verticalLabels = result.dataSets[0];
      isVerticalStale = result.isStale;
    }

    let horizontalLabels = this.horizontalLabels;
    let isHorizontalStale = false;
    if (horizontalLabels) {
      const result = updateChartRangesWithDataSets(
        this.getters,
        applyChange,
        [horizontalLabels],
        undefined
      );
      horizontalLabels = result.dataSets[0];
      isHorizontalStale = result.isStale;
    }

    if (!isStale && !isVerticalStale && !isHorizontalStale) {
      return this;
    }
    const definition = this.getDefinitionWithSpecificDataSets(
      dataSets,
      verticalLabels,
      horizontalLabels
    );
    return new HeatmapChart(definition, this.sheetId, this.getters);
  }
}

const heatmapChartPlugin = {
  id: "heatmapChartPlugin",
  beforeDatasetsDraw: (chart: any, args: any, options: any) => {
    const { ctx, chartArea } = chart;
    const { dataSetsValues, colorScaleDef, minValue, maxValue, interpolationType } = options;

    if (!dataSetsValues || dataSetsValues.length === 0) {
      return;
    }

    // Remove the datasets default drawing by clearing them or setting them to hidden?
    // We already set backgroundColor to transparent in creation, so they are invisible but take space.

    const width = dataSetsValues[0].data.length;
    const height = dataSetsValues.length;
    if (width === 0 || height === 0) {
      return;
    }

    // Create offscreen canvas for heatmap generation
    const offscreenCanvas = document.createElement("canvas");
    offscreenCanvas.width = width;
    offscreenCanvas.height = height;
    const offCtx = offscreenCanvas.getContext("2d");
    if (!offCtx) {
      return;
    }

    const colorMap = getRuntimeColorScale(colorScaleDef, minValue, maxValue);

    // Fill background with transparent
    offCtx.clearRect(0, 0, width, height);

    for (let dsIndex = 0; dsIndex < height; dsIndex++) {
      const rowData = dataSetsValues[dsIndex].data;
      // Image y: 0 is top.
      const y = dsIndex;

      for (let x = 0; x < width; x++) {
        const value = rowData[x];
        if (typeof value === "number" && !isNaN(value)) {
          const colorHex = colorMap(value);
          offCtx.fillStyle = colorHex;
          offCtx.fillRect(x, y, 1, 1);
        } else {
          // Leave transparent
        }
      }
    }

    // Draw offscreen canvas to main canvas with smoothing
    ctx.save();

    ctx.imageSmoothingEnabled = interpolationType !== "nearest";

    if (interpolationType === "gaussian") {
      ctx.filter = "blur(4px)"; // Slight blur for gaussian effect
      ctx.imageSmoothingQuality = "high";
    } else if (interpolationType === "bicubic") {
      ctx.imageSmoothingQuality = "high";
    } else if (interpolationType === "bilinear") {
      ctx.imageSmoothingQuality = "medium";
    } else {
      ctx.imageSmoothingEnabled = false;
    }

    // We simply stretch the image to the chartArea
    ctx.drawImage(
      offscreenCanvas,
      chartArea.left,
      chartArea.top,
      chartArea.width,
      chartArea.height
    );

    ctx.restore();
  },
};

export function createHeatmapChartRuntime(
  chart: HeatmapChart,
  getters: Getters
): { chartJsConfig: ChartConfiguration; background: Color } {
  const definition = chart.getDefinition();
  const dataSetsValues = getChartDatasetValues(getters, chart.dataSets);

  // Use getRangeFormattedValues to preserve number formatting
  const verticalLabelData = chart.verticalLabels
    ? getters.getRangeFormattedValues(chart.verticalLabels.dataRange)
    : undefined;
  const verticalLabelValues = verticalLabelData
    ? { label: "", data: verticalLabelData }
    : undefined;

  const horizontalLabelData = chart.horizontalLabels
    ? getters.getRangeFormattedValues(chart.horizontalLabels.dataRange)
    : undefined;

  const maxLen = Math.max(0, ...dataSetsValues.map((d) => d.data.length));
  let labels: string[];
  if (horizontalLabelData) {
    labels = horizontalLabelData;
  } else {
    labels = Array.from({ length: maxLen }, (_, i) => String(i + 1));
  }

  let yLabels: string[];
  if (verticalLabelValues) {
    yLabels = verticalLabelValues.data.map(String);
  } else {
    yLabels = dataSetsValues.map((d) => d.label || "");
  }

  // Reuse Matrix Chart scales
  const matrixDefinition = definition as unknown as MatrixChartDefinition;
  const scales = getMatrixChartScales(matrixDefinition, yLabels);

  // Prepare datasets but make them transparent and hidden legend
  const datasets = getMatrixChartDataset(matrixDefinition, {
    dataSetsValues,
    verticalLabelValues,
  }).map((ds) => ({
    ...ds,
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderWidth: 0,
  }));

  // Color Scale Logic
  const allValues = dataSetsValues
    .map((ds) => ds.data)
    .flat()
    .filter((v) => typeof v === "number" && !isNaN(v)) as number[];
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const colorScaleDef = definition.colorScale ?? DEFAULT_CHART_COLOR_SCALE;

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels,
      datasets,
    },
    options: {
      ...CHART_COMMON_OPTIONS,
      indexAxis: "x",
      responsive: true,
      maintainAspectRatio: false,
      scales,
      plugins: {
        title: getChartTitle(definition, getters),
        legend: {
          display: false,
        },
        tooltip: getMatrixChartTooltip(dataSetsValues),
        chartColorScalePlugin: getMatrixColorScale(matrixDefinition, {
          dataSetsValues,
          locale: getters.getLocale(),
        } as any),
        heatmapChartPlugin: {
          dataSetsValues,
          colorScaleDef,
          minValue,
          maxValue,
          interpolationType: definition.interpolationType || "bilinear",
        },
        chartShowValuesPlugin: undefined,
      } as any,
      layout: getMatrixChartLayout(matrixDefinition, {
        topPadding: getTopPaddingForDashboard(definition as any, getters),
      } as any),
    },
    plugins: [heatmapChartPlugin],
  };

  return { chartJsConfig: config, background: chart.background || "white" };
}
