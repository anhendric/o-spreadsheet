import { CoreGetters, RangeAdapterFunctions, Validator } from "@odoo/o-spreadsheet-engine";
import { BACKGROUND_CHART_COLOR } from "@odoo/o-spreadsheet-engine/constants";
import { getColorsPalette, getNthColor } from "@odoo/o-spreadsheet-engine/helpers/color";
import { AbstractChart } from "@odoo/o-spreadsheet-engine/helpers/figures/charts/abstract_chart";
import {
  chartFontColor,
  checkDataset,
  checkLabelRange,
  createDataSets,
  duplicateDataSetsInDuplicatedSheet,
  duplicateLabelRangeInDuplicatedSheet,
  getDefinedAxis,
  shouldRemoveFirstLabel,
  transformChartDefinitionWithDataSetsWithZone,
  updateChartRangesWithDataSets,
} from "@odoo/o-spreadsheet-engine/helpers/figures/charts/chart_common";
import { CHART_COMMON_OPTIONS } from "@odoo/o-spreadsheet-engine/helpers/figures/charts/chart_ui_common";
import { percentile } from "@odoo/o-spreadsheet-engine/helpers/numbers";
import { createValidRange } from "@odoo/o-spreadsheet-engine/helpers/range";
import {
  AxesDesign,
  BoxPlotChartDefinition,
  ChartCreationContext,
  ChartJSRuntime,
  CustomizedDataSet,
  DataSet,
  DatasetDesign,
  ExcelChartDefinition,
} from "@odoo/o-spreadsheet-engine/types/chart";
import { LegendPosition } from "@odoo/o-spreadsheet-engine/types/chart/common_chart";
import { CommandResult } from "@odoo/o-spreadsheet-engine/types/commands";
import { Getters } from "@odoo/o-spreadsheet-engine/types/getters";
import { Color, RangeAdapter, UID } from "@odoo/o-spreadsheet-engine/types/misc";
import { Range } from "@odoo/o-spreadsheet-engine/types/range";
import { toXlsxHexColor } from "@odoo/o-spreadsheet-engine/xlsx/helpers/colors";
import type { ChartConfiguration } from "chart.js";
import { getChartLayout } from "./runtime/chartjs_layout";
import { getChartTitle } from "./runtime/chartjs_title";

export class BoxPlotChart extends AbstractChart {
  readonly dataSets: DataSet[];
  readonly labelRange?: Range | undefined;
  readonly background?: Color;
  readonly legendPosition: LegendPosition;
  readonly type = "boxplot" as const;
  readonly dataSetsHaveTitle: boolean;
  readonly dataSetDesign?: DatasetDesign[];
  readonly axesDesign?: AxesDesign;
  readonly showValues?: boolean;
  readonly style?: "box" | "outlines";

  constructor(definition: BoxPlotChartDefinition, sheetId: UID, getters: CoreGetters) {
    super(definition, sheetId, getters);
    this.dataSets = createDataSets(
      getters,
      definition.dataSets,
      sheetId,
      definition.dataSetsHaveTitle
    );
    this.labelRange = createValidRange(getters, sheetId, definition.labelRange);
    this.background = definition.background;
    this.legendPosition = definition.legendPosition;
    this.dataSetsHaveTitle = definition.dataSetsHaveTitle;
    this.dataSetDesign = definition.dataSets;
    this.axesDesign = definition.axesDesign;
    this.showValues = definition.showValues;
    this.style = definition.style;
  }

  static transformDefinition(
    chartSheetId: UID,
    definition: BoxPlotChartDefinition,
    applyChange: RangeAdapter
  ): BoxPlotChartDefinition {
    return transformChartDefinitionWithDataSetsWithZone(chartSheetId, definition, applyChange);
  }

  static validateChartDefinition(
    validator: Validator,
    definition: BoxPlotChartDefinition
  ): CommandResult | CommandResult[] {
    return validator.checkValidations(definition, checkDataset, checkLabelRange);
  }

  static getDefinitionFromContextCreation(context: ChartCreationContext): BoxPlotChartDefinition {
    return {
      background: context.background,
      dataSets: context.range ?? [],
      dataSetsHaveTitle: context.dataSetsHaveTitle ?? false,
      legendPosition: context.legendPosition ?? "top",
      title: context.title || { text: "" },
      type: "boxplot",
      labelRange: context.auxiliaryRange || undefined,
      axesDesign: context.axesDesign,
      showValues: context.showValues,
      style: "box",
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
      auxiliaryRange: this.labelRange
        ? this.getters.getRangeString(this.labelRange, this.sheetId)
        : undefined,
    };
  }

  duplicateInDuplicatedSheet(newSheetId: UID): BoxPlotChart {
    const dataSets = duplicateDataSetsInDuplicatedSheet(this.sheetId, newSheetId, this.dataSets);
    const labelRange = duplicateLabelRangeInDuplicatedSheet(
      this.sheetId,
      newSheetId,
      this.labelRange
    );
    const definition = this.getDefinitionWithSpecificDataSets(dataSets, labelRange, newSheetId);
    return new BoxPlotChart(definition, newSheetId, this.getters);
  }

  copyInSheetId(sheetId: UID): BoxPlotChart {
    const definition = this.getDefinitionWithSpecificDataSets(
      this.dataSets,
      this.labelRange,
      sheetId
    );
    return new BoxPlotChart(definition, sheetId, this.getters);
  }

  getDefinition(): BoxPlotChartDefinition {
    return this.getDefinitionWithSpecificDataSets(this.dataSets, this.labelRange);
  }

  private getDefinitionWithSpecificDataSets(
    dataSets: DataSet[],
    labelRange: Range | undefined,
    targetSheetId?: UID
  ): BoxPlotChartDefinition {
    const ranges: CustomizedDataSet[] = [];
    for (const [i, dataSet] of dataSets.entries()) {
      ranges.push({
        ...this.dataSetDesign?.[i],
        dataRange: this.getters.getRangeString(dataSet.dataRange, targetSheetId || this.sheetId),
      });
    }
    return {
      type: "boxplot",
      dataSetsHaveTitle: dataSets.length ? Boolean(dataSets[0].labelCell) : false,
      background: this.background,
      dataSets: ranges,
      legendPosition: this.legendPosition,
      labelRange: labelRange
        ? this.getters.getRangeString(labelRange, targetSheetId || this.sheetId)
        : undefined,
      title: this.title,
      axesDesign: this.axesDesign,
      showValues: this.showValues,
      style: this.style,
    };
  }

  getDefinitionForExcel(): ExcelChartDefinition | undefined {
    // Excel might not support boxplot export directly with this structure, or it might require different handling.
    // For now, return undefined to skip export, or try to map it to something common.
    // BoxPlot in Excel is complex to generate via simple xml mapping often used here.
    const { dataSets, labelRange } = this.getCommonDataSetAttributesForExcel(
      this.labelRange,
      this.dataSets,
      shouldRemoveFirstLabel(this.labelRange, this.dataSets[0], this.dataSetsHaveTitle)
    );
    const definition = this.getDefinition();
    return {
      ...definition,
      type: "bar" as any, // Fallback or incorrect type for now to avoid types error if 'boxplot' not in Excel chart types
      backgroundColor: toXlsxHexColor(this.background || BACKGROUND_CHART_COLOR),
      fontColor: toXlsxHexColor(chartFontColor(this.background)),
      dataSets,
      labelRange,
      verticalAxis: getDefinedAxis(definition),
    };
  }

  updateRanges({ applyChange }: RangeAdapterFunctions): BoxPlotChart {
    const { dataSets, labelRange, isStale } = updateChartRangesWithDataSets(
      this.getters,
      applyChange,
      this.dataSets,
      this.labelRange
    );
    if (!isStale) {
      return this;
    }
    const definition = this.getDefinitionWithSpecificDataSets(dataSets, labelRange);
    return new BoxPlotChart(definition, this.sheetId, this.getters);
  }
}

export function createBoxPlotChartRuntime(chart: BoxPlotChart, getters: Getters): ChartJSRuntime {
  const definition = chart.getDefinition();

  // Box Plot Data Calculation
  const datasets = chart.dataSets.map((dataSet, index) => {
    const dataRange = dataSet.dataRange;
    const colors = getColorsPalette(chart.dataSets.length);
    const values: number[] = [];

    // Extract numerical values from the dataset range
    const cells = getters.getRangeValues(dataRange); // getRangeValues takes Range object
    for (const cell of cells) {
      const val = Number(cell);
      if (!isNaN(val) && cell !== "") {
        values.push(val);
      }
    }

    if (values.length === 0) {
      return {
        label:
          definition.dataSets[index]?.label ||
          (dataSet.labelCell
            ? getters.getRangeValues(dataSet.labelCell)[0]
            : `Series ${index + 1}`),
        data: [],
        backgroundColor:
          chart.style === "outlines"
            ? "#ffffff00"
            : definition.dataSets[index]?.backgroundColor || getNthColor(index, colors), // Default color
        borderColor: definition.dataSets[index]?.backgroundColor || getNthColor(index, colors),
        borderWidth: 1,
      };
    }

    values.sort((a, b) => a - b);

    const min = values[0];
    const max = values[values.length - 1];
    const q1 = percentile(values, 0.25, true);
    const median = percentile(values, 0.5, true);
    const q3 = percentile(values, 0.75, true);

    return {
      label:
        definition.dataSets[index]?.label ||
        (dataSet.labelCell ? getters.getRangeValues(dataSet.labelCell)[0] : `Series ${index + 1}`),
      data: [[min, q1, median, q3, max]], // Format for custom controller
      backgroundColor:
        chart.style === "outlines"
          ? "#ffffff00"
          : definition.dataSets[index]?.backgroundColor || getNthColor(index, colors), // Fallback color
      borderColor: definition.dataSets[index]?.backgroundColor || getNthColor(index, colors),
      borderWidth: 1,
    };
  });

  const datasetLabels = datasets.map((d) => d.label);

  const config: ChartConfiguration<"boxplot"> = {
    type: "boxplot" as any,
    data: {
      labels: datasetLabels, // One label per box
      datasets: [
        {
          label: "Box Plot",
          data: datasets.map((d) => d.data[0]),
          backgroundColor: datasets.map((d) => d.backgroundColor),
          borderColor: datasets.map((d) => d.borderColor),
          borderWidth: 1,
        },
      ] as any,
    },
    options: {
      ...CHART_COMMON_OPTIONS,
      layout: getChartLayout(definition, {
        labels: datasetLabels,
        dataSetsValues: [],
      } as any), // Mock data for layout
      scales: {
        x: {
          grid: {
            display: false,
          },
        },
        y: {
          beginAtZero: false,
        },
      },
      plugins: {
        title: getChartTitle(definition, getters),
        legend: { display: false }, // Usually not needed if x-axis labels are series names
        tooltip: {
          callbacks: {
            label: (context: any) => {
              const v = context.raw;
              if (!v || v.length < 5) {
                return "";
              }
              return [
                `Max: ${v[4]}`,
                `Q3: ${v[3]}`,
                `Median: ${v[2]}`,
                `Q1: ${v[1]}`,
                `Min: ${v[0]}`,
              ];
            },
          },
        } as any,
      },
    },
  };

  return {
    chartJsConfig: config as any,
    background: chart.background || BACKGROUND_CHART_COLOR,
  };
}
