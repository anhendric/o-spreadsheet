import { SeriesDesignEditor } from "../building_blocks/series_design/series_design_editor";

export class BoxPlotSeriesDesignEditor extends SeriesDesignEditor {
  getDataSeries() {
    const dataSets = this.props.definition.dataSets;
    return dataSets.map((dataSet, index) => {
      const labelCell = dataSet.labelCell;
      return labelCell
        ? this.env.model.getters.getRangeValues(labelCell)[0]?.toString() ?? ""
        : `Series ${index + 1}`;
    });
  }
}
