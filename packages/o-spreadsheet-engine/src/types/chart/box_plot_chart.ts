import {
  BarControllerChartOptions,
  BarControllerDatasetOptions,
  CartesianParsedData,
  CartesianScaleTypeRegistry,
  ChartConfiguration,
} from "chart.js";
import { Color } from "../misc";
import { CommonChartDefinition } from "./index";

declare module "chart.js" {
  interface ChartTypeRegistry {
    boxplot: {
      chartOptions: BarControllerChartOptions;
      datasetOptions: BarControllerDatasetOptions;
      defaultDataPoint: number[] | null;
      metaExtensions: {};
      parsedDataType: CartesianParsedData;
      scales: keyof CartesianScaleTypeRegistry;
    };
  }
}

export interface BoxPlotChartDefinition extends CommonChartDefinition {
  readonly type: "boxplot";
  readonly showValues?: boolean;
  readonly style?: "box" | "outlines";
}

export type BoxPlotChartRuntime = {
  chartJsConfig: ChartConfiguration<"boxplot">;
  background: Color;
};
