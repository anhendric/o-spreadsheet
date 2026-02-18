import { HistogramChartDefinition } from "@odoo/o-spreadsheet-engine/types/chart/histogram_chart";
import { ActionButton } from "../../../action_button/action_button";
import { Section } from "../../components/section/section";
import { GenericChartConfigPanel } from "../building_blocks/generic_side_panel/config_panel";

export class HistogramChartConfigPanel extends GenericChartConfigPanel {
  static template = "o-spreadsheet-HistogramChartConfigPanel";
  static components = {
    ...GenericChartConfigPanel.components,
    Section,
    ActionButton,
  };

  get bucketSize(): number | undefined {
    return (this.props.definition as HistogramChartDefinition).bucketSize;
  }

  get outlierPercentage(): number | undefined {
    return (this.props.definition as HistogramChartDefinition).outlierPercentage;
  }

  onUpdateBucketSize(ev: InputEvent) {
    const value = parseFloat((ev.target as HTMLInputElement).value);
    this.props.updateChart(this.props.chartId, {
      bucketSize: isNaN(value) ? undefined : value,
    });
  }

  onUpdateOutlierPercentage(ev: InputEvent) {
    const value = parseFloat((ev.target as HTMLInputElement).value);
    this.props.updateChart(this.props.chartId, {
      outlierPercentage: isNaN(value) ? undefined : value,
    });
  }
}
