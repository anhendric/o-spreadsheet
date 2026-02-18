import { CoreGetters, RangeAdapterFunctions, Validator } from "@odoo/o-spreadsheet-engine";
import { BACKGROUND_CHART_COLOR } from "@odoo/o-spreadsheet-engine/constants";
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
  ChartCreationContext,
  CustomizedDataSet,
  DataSet,
  DatasetDesign,
  ExcelChartDefinition,
} from "@odoo/o-spreadsheet-engine/types/chart/chart";
import { LegendPosition } from "@odoo/o-spreadsheet-engine/types/chart/common_chart";
import {
  HistogramChartDefinition,
  HistogramChartRuntime,
} from "@odoo/o-spreadsheet-engine/types/chart/histogram_chart";
import { CommandResult } from "@odoo/o-spreadsheet-engine/types/commands";
import { Color, RangeAdapter, UID } from "@odoo/o-spreadsheet-engine/types/misc";
import { ChartConfiguration } from "chart.js";
import { getHistogramChartData } from "./runtime/chart_data_extractor";
import { getHistogramChartDatasets } from "./runtime/chartjs_dataset";
import { getChartLayout } from "./runtime/chartjs_layout";
import { getHistogramChartLegend } from "./runtime/chartjs_legend";
import { getHistogramChartScales } from "./runtime/chartjs_scales";
import { getChartTitle } from "./runtime/chartjs_title";

export class HistogramChart extends AbstractChart {
  readonly dataSets: DataSet[];
  readonly background?: Color;
  readonly legendPosition: LegendPosition;
  readonly type = "histogram";
  readonly dataSetsHaveTitle: boolean;
  readonly dataSetDesign?: DatasetDesign[];
  readonly axesDesign?: AxesDesign;
  readonly showValues?: boolean;
  readonly bucketSize?: number;
  readonly outlierPercentage?: number;

  constructor(definition: HistogramChartDefinition, sheetId: UID, getters: CoreGetters) {
    super(definition, sheetId, getters);
    this.dataSets = createDataSets(
      getters,
      definition.dataSets,
      sheetId,
      definition.dataSetsHaveTitle
    );
    this.background = definition.background;
    this.legendPosition = definition.legendPosition;
    this.dataSetsHaveTitle = definition.dataSetsHaveTitle;
    this.dataSetDesign = definition.dataSets;
    this.axesDesign = definition.axesDesign;
    this.showValues = definition.showValues;
    this.bucketSize = definition.bucketSize;
    this.outlierPercentage = definition.outlierPercentage;
  }

  static transformDefinition(
    chartSheetId: UID,
    definition: HistogramChartDefinition,
    applyChange: RangeAdapter
  ): HistogramChartDefinition {
    return transformChartDefinitionWithDataSetsWithZone(chartSheetId, definition, applyChange);
  }

  static validateChartDefinition(
    validator: Validator,
    definition: HistogramChartDefinition
  ): CommandResult | CommandResult[] {
    return validator.checkValidations(definition, checkDataset);
  }

  static getDefinitionFromContextCreation(context: ChartCreationContext): HistogramChartDefinition {
    return {
      background: context.background,
      dataSets: context.range ?? [],
      dataSetsHaveTitle: context.dataSetsHaveTitle ?? false,
      legendPosition: context.legendPosition ?? "top",
      title: context.title || { text: "" },
      type: "histogram",
      axesDesign: context.axesDesign,
      showValues: context.showValues,
    };
  }

  getContextCreation(): ChartCreationContext {
    const range: CustomizedDataSet[] = [];
    for (const [i, dataSet] of this.dataSets.entries()) {
      range.push({
        ...this.dataSetDesign?.[i],
        dataRange: this.getters.getRangeString(dataSet.dataRange, this.sheetId),
      });
    }
    return {
      ...this,
      range,
    };
  }

  duplicateInDuplicatedSheet(newSheetId: UID): HistogramChart {
    const dataSets = duplicateDataSetsInDuplicatedSheet(this.sheetId, newSheetId, this.dataSets);
    const definition = this.getDefinitionWithSpecificDataSets(dataSets, newSheetId);
    return new HistogramChart(definition, newSheetId, this.getters);
  }

  copyInSheetId(sheetId: UID): HistogramChart {
    const definition = this.getDefinitionWithSpecificDataSets(this.dataSets, sheetId);
    return new HistogramChart(definition, sheetId, this.getters);
  }

  getDefinition(): HistogramChartDefinition {
    return this.getDefinitionWithSpecificDataSets(this.dataSets);
  }

  private getDefinitionWithSpecificDataSets(
    dataSets: DataSet[],
    targetSheetId?: UID
  ): HistogramChartDefinition {
    const ranges: CustomizedDataSet[] = [];
    for (const [i, dataSet] of dataSets.entries()) {
      ranges.push({
        ...this.dataSetDesign?.[i],
        dataRange: this.getters.getRangeString(dataSet.dataRange, targetSheetId || this.sheetId),
      });
    }
    return {
      type: "histogram",
      dataSetsHaveTitle: dataSets.length ? Boolean(dataSets[0].labelCell) : false,
      background: this.background,
      dataSets: ranges,
      legendPosition: this.legendPosition,
      title: this.title,
      axesDesign: this.axesDesign,
      showValues: this.showValues,
      bucketSize: this.bucketSize,
      outlierPercentage: this.outlierPercentage,
    };
  }

  getDefinitionForExcel(): ExcelChartDefinition | undefined {
    return undefined;
  }

  updateRanges({ applyChange }: RangeAdapterFunctions): HistogramChart {
    const { dataSets, isStale } = updateChartRangesWithDataSets(
      this.getters,
      applyChange,
      this.dataSets,
      undefined
    );
    if (!isStale) {
      return this;
    }
    const definition = this.getDefinitionWithSpecificDataSets(dataSets);
    return new HistogramChart(definition, this.sheetId, this.getters);
  }
}

import { Getters } from "@odoo/o-spreadsheet-engine/types/getters";

export function createHistogramChartRuntime(
  chart: HistogramChart,
  getters: Getters
): HistogramChartRuntime {
  const definition = chart.getDefinition();
  const runtimeArgs = getHistogramChartData(definition, chart.dataSets, getters);
  const layout = getChartLayout(definition, runtimeArgs);
  const legend = getHistogramChartLegend(definition, runtimeArgs);
  const scales = getHistogramChartScales(definition, runtimeArgs);
  const datasets = getHistogramChartDatasets(definition, runtimeArgs);

  const config: ChartConfiguration = {
    type: "bar",
    data: {
      labels: runtimeArgs.labels,
      datasets,
    },
    options: {
      ...CHART_COMMON_OPTIONS,
      layout,
      scales,
      plugins: {
        title: getChartTitle(definition, getters),
        legend,
      },
    },
  };
  return { chartJsConfig: config, background: chart.background || BACKGROUND_CHART_COLOR };
}
