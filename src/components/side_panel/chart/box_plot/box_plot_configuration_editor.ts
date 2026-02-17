import { BoxPlotChartDefinition } from "@odoo/o-spreadsheet-engine/types/chart";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component } from "@odoo/owl";
import { Checkbox } from "../../components/checkbox/checkbox";
import { SidePanelCollapsible } from "../../components/collapsible/side_panel_collapsible";
import { Section } from "../../components/section/section";
import { ChartSidePanelProps, ChartSidePanelPropsObject } from "../common";

export class BoxPlotConfigurationEditor extends Component<
  ChartSidePanelProps<BoxPlotChartDefinition>,
  SpreadsheetChildEnv
> {
  static template = "o-spreadsheet-BoxPlotConfigurationEditor";
  static components = { SidePanelCollapsible, Section, Checkbox };
  static props = ChartSidePanelPropsObject;

  get isOutlined() {
    // Check if the style property exists and is "outlines"
    // Since ChartWithDataSetDefinition is generic, we might need to cast or access it dynamically if TS complains
    return (this.props.definition as any).style === "outlines";
  }

  onToggleOutlined(isOutlined: boolean) {
    this.props.updateChart(this.props.chartId, {
      style: isOutlined ? "outlines" : "box",
    } as any);
  }
}
