import { Color } from "../..";
import { AxesDesign, ChartColorScale, CustomizedDataSet } from "./chart";
import { CommonChartDefinition, LegendPosition } from "./common_chart";

export interface HeatmapChartDefinition extends CommonChartDefinition {
  readonly type: "heatmap";
  readonly dataSets: CustomizedDataSet[];
  readonly verticalLabels?: CustomizedDataSet;
  readonly horizontalLabels?: CustomizedDataSet;
  readonly dataSetsHaveTitle: boolean;
  readonly colorScale?: ChartColorScale;
  readonly axesDesign?: AxesDesign;
  readonly legendPosition: LegendPosition;
  readonly missingValueColor?: Color;
  readonly interpolationType?: "nearest" | "bilinear" | "bicubic" | "gaussian";
}
