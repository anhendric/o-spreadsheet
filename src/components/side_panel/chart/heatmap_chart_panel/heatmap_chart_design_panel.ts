import { _t } from "@odoo/o-spreadsheet-engine";
import { LegendPosition } from "@odoo/o-spreadsheet-engine/types/chart";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component } from "@odoo/owl";
import { Color } from "../../../../types/index";
import { SidePanelCollapsible } from "../../components/collapsible/side_panel_collapsible";
import { RoundColorPicker } from "../../components/round_color_picker/round_color_picker";
import { Section } from "../../components/section/section";
import {
  AxisDefinition,
  AxisDesignEditor,
} from "../building_blocks/axis_design/axis_design_editor";
import { ColorScalePicker } from "../building_blocks/color_scale/color_scale_picker";
import { GeneralDesignEditor } from "../building_blocks/general_design/general_design_editor";
import { ChartSidePanelPropsObject } from "../common";

export class HeatmapChartDesignPanel extends Component<any, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-HeatmapChartDesignPanel";
  static components = {
    GeneralDesignEditor,
    SidePanelCollapsible,
    Section,
    AxisDesignEditor,
    ColorScalePicker,
    RoundColorPicker,
  };
  static props = ChartSidePanelPropsObject;

  get axesList(): AxisDefinition[] {
    return [
      { id: "x", name: _t("Horizontal axis") },
      { id: "y", name: _t("Vertical axis") },
    ];
  }

  onColormapChange(colorScale): void {
    this.props.updateChart(this.props.chartId, {
      colorScale,
    });
  }

  updateMissingValueColor(color: Color) {
    this.props.updateChart(this.props.chartId, { missingValueColor: color });
  }

  get selectedMissingValueColor() {
    return this.props.definition.missingValueColor;
  }

  updateLegendPosition(ev: Event) {
    const value = (ev.target as HTMLSelectElement).value as LegendPosition;
    this.props.updateChart(this.props.chartId, { legendPosition: value });
  }

  updateInterpolationType(ev: Event) {
    const value = (ev.target as HTMLSelectElement).value;
    this.props.updateChart(this.props.chartId, { interpolationType: value });
  }
}
