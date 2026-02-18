import { HistogramChartDefinition } from "@odoo/o-spreadsheet-engine/types/chart/histogram_chart";
import { ChartWithAxisDesignPanel } from "../chart_with_axis/design_panel";
import { ChartSidePanelProps } from "../common";

interface Props extends ChartSidePanelProps<HistogramChartDefinition> {}

export class HistogramChartDesignPanel extends ChartWithAxisDesignPanel<Props> {
  static template = "o-spreadsheet-ChartWithAxisDesignPanel";
}
