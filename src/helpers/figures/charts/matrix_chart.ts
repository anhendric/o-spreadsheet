import { CoreGetters, RangeAdapterFunctions, Validator } from "@odoo/o-spreadsheet-engine";
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
import { MatrixChartDefinition } from "@odoo/o-spreadsheet-engine/types/chart/matrix_chart";
import { ChartConfiguration } from "chart.js";
import { Color, CommandResult, DataSet, Getters, RangeAdapter, UID } from "../../../types";
import { getMatrixChartTooltip } from "./runtime";
import { getChartDatasetValues, getTopPaddingForDashboard } from "./runtime/chart_data_extractor";
import { getMatrixChartDataset } from "./runtime/chartjs_dataset";
import { getMatrixChartLayout } from "./runtime/chartjs_layout";
import { getMatrixChartScales, getMatrixColorScale } from "./runtime/chartjs_scales";
import { getChartTitle } from "./runtime/chartjs_title";

export class MatrixChart extends AbstractChart {
  readonly dataSets: DataSet[];
  readonly verticalLabels?: DataSet;
  readonly horizontalLabels?: DataSet;
  readonly background?: Color;
  readonly type: any = "matrix";
  readonly colorScale?: ChartColorScale;
  readonly axesDesign?: AxesDesign;
  readonly legendPosition: LegendPosition;
  readonly missingValueColor?: Color;
  readonly dataSetsHaveTitle: boolean;

  constructor(definition: MatrixChartDefinition, sheetId: UID, getters: CoreGetters) {
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
  }

  static transformDefinition(
    chartSheetId: UID,
    definition: ChartDefinition,
    applyChange: RangeAdapter
  ): ChartDefinition {
    const matrixDef = definition as unknown as MatrixChartDefinition;
    const dataSetsValues = transformChartDefinitionWithDataSetsWithZone(
      chartSheetId,
      { ...definition, dataSets: matrixDef.dataSets } as unknown as ChartWithDataSetDefinition,
      applyChange
    ) as unknown as MatrixChartDefinition;

    let verticalLabels: CustomizedDataSet | undefined;
    if (matrixDef.verticalLabels) {
      const verticalDef = transformChartDefinitionWithDataSetsWithZone(
        chartSheetId,
        {
          ...definition,
          dataSets: [matrixDef.verticalLabels],
        } as unknown as ChartWithDataSetDefinition,
        applyChange
      ) as unknown as ChartWithDataSetDefinition;
      verticalLabels = verticalDef.dataSets[0];
    }

    let horizontalLabels: CustomizedDataSet | undefined;
    if (matrixDef.horizontalLabels) {
      const horizontalDef = transformChartDefinitionWithDataSetsWithZone(
        chartSheetId,
        {
          ...definition,
          dataSets: [matrixDef.horizontalLabels],
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
    // Reuse checkDataset for labels?
    // checkDataset validates `definition.dataSets`.
    // We might want to validate labels manually or construct a fake definition to validate.
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
      type: "matrix",
      axesDesign: context.axesDesign,
      legendPosition,
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

  duplicateInDuplicatedSheet(newSheetId: UID): MatrixChart {
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
    return new MatrixChart(definition, newSheetId, this.getters);
  }

  copyInSheetId(sheetId: UID): MatrixChart {
    const definition = this.getDefinitionWithSpecificDataSets(
      this.dataSets,
      this.verticalLabels,
      this.horizontalLabels,
      sheetId
    );
    return new MatrixChart(definition, sheetId, this.getters);
  }

  getDefinition(): MatrixChartDefinition {
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
  ): MatrixChartDefinition {
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
      type: "matrix",
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
    };
  }

  getDefinitionForExcel(): ExcelChartDefinition | undefined {
    return undefined;
  }

  updateRanges({ applyChange }: RangeAdapterFunctions): MatrixChart {
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
    return new MatrixChart(definition, this.sheetId, this.getters);
  }
}

export function createMatrixChartRuntime(
  chart: MatrixChart,
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

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels,
      datasets: getMatrixChartDataset(definition, { dataSetsValues, verticalLabelValues }),
    },
    options: {
      ...CHART_COMMON_OPTIONS,
      indexAxis: "x",
      responsive: true,
      maintainAspectRatio: false,
      scales: getMatrixChartScales(definition, yLabels),
      plugins: {
        title: getChartTitle(definition, getters),
        legend: {
          display: false,
        },
        tooltip: getMatrixChartTooltip(dataSetsValues),
        chartColorScalePlugin: getMatrixColorScale(definition, {
          dataSetsValues,
          locale: getters.getLocale(),
        } as any),
        chartShowValuesPlugin: undefined, // TODO: Implement if needed
      } as any,
      layout: getMatrixChartLayout(definition, {
        topPadding: getTopPaddingForDashboard(definition as any, getters),
      } as any),
    },
  };

  return { chartJsConfig: config, background: chart.background || "white" };
}
