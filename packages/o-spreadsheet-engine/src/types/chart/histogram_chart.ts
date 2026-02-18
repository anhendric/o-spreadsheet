import { ChartConfiguration } from "chart.js";
import { Color } from "../misc";
import { CommonChartDefinition } from "./common_chart";

export interface HistogramChartDefinition extends CommonChartDefinition {
  readonly type: "histogram";
  readonly bucketSize?: number;
  readonly outlierPercentage?: number;
}

export type HistogramChartRuntime = {
  chartJsConfig: ChartConfiguration;
  background?: Color;
};
