import { onWillUpdateProps, useState } from "@odoo/owl";
import { GenericChartConfigPanel } from "../building_blocks/generic_side_panel/config_panel";

export class MatrixChartConfigPanel extends GenericChartConfigPanel<any> {
  static template = "o-spreadsheet-MatrixChartConfigPanel";

  private labelState = useState({
    vertical: "",
    horizontal: "",
  });

  setup() {
    super.setup();
    this.labelState.vertical = this.props.definition.verticalLabels?.dataRange || "";
    this.labelState.horizontal = this.props.definition.horizontalLabels?.dataRange || "";

    onWillUpdateProps((nextProps) => {
      const newVertical = nextProps.definition.verticalLabels?.dataRange || "";
      const oldVertical = this.props.definition.verticalLabels?.dataRange || "";
      if (newVertical !== oldVertical) {
        this.labelState.vertical = newVertical;
      }
      const newHorizontal = nextProps.definition.horizontalLabels?.dataRange || "";
      const oldHorizontal = this.props.definition.horizontalLabels?.dataRange || "";
      if (newHorizontal !== oldHorizontal) {
        this.labelState.horizontal = newHorizontal;
      }
    });
  }

  getVerticalLabelsRange() {
    return this.labelState.vertical;
  }

  onVerticalLabelsRangeChanged(ranges: string[]) {
    this.labelState.vertical = ranges[0] || "";
  }

  onVerticalLabelsRangeConfirmed() {
    const dataSet = this.labelState.vertical ? { dataRange: this.labelState.vertical } : undefined;
    this.props.updateChart(this.props.chartId, {
      verticalLabels: dataSet,
    });
  }

  getHorizontalLabelsRange() {
    return this.labelState.horizontal;
  }

  onHorizontalLabelsRangeChanged(ranges: string[]) {
    this.labelState.horizontal = ranges[0] || "";
  }

  onHorizontalLabelsRangeConfirmed() {
    const dataSet = this.labelState.horizontal
      ? { dataRange: this.labelState.horizontal }
      : undefined;
    this.props.updateChart(this.props.chartId, {
      horizontalLabels: dataSet,
    });
  }
}
