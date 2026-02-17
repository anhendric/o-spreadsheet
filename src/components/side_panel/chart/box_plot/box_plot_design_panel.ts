import { SidePanelCollapsible } from "../../components/collapsible/side_panel_collapsible";
import { Section } from "../../components/section/section";
import { AxisDesignEditor } from "../building_blocks/axis_design/axis_design_editor";
import { GeneralDesignEditor } from "../building_blocks/general_design/general_design_editor";
import { ChartHumanizeNumbers } from "../building_blocks/humanize_numbers/humanize_numbers";
import { ChartLegend } from "../building_blocks/legend/legend";
import { SeriesWithAxisDesignEditor } from "../building_blocks/series_design/series_with_axis_design_editor";
import { ChartShowValues } from "../building_blocks/show_values/show_values";
import { ChartWithAxisDesignPanel } from "../chart_with_axis/design_panel";
import { BoxPlotConfigurationEditor } from "./box_plot_configuration_editor";
import { BoxPlotSeriesDesignEditor } from "./box_plot_series_design_editor";

export class BoxPlotDesignPanel extends ChartWithAxisDesignPanel<any> {
  static template = "o-spreadsheet-BoxPlotDesignPanel";
  static components = {
    GeneralDesignEditor,
    SidePanelCollapsible,
    Section,
    AxisDesignEditor,
    BoxPlotConfigurationEditor,
    SeriesDesignEditor: BoxPlotSeriesDesignEditor,
    SeriesWithAxisDesignEditor,
    ChartLegend,
    ChartShowValues,
    ChartHumanizeNumbers,
  };
}
