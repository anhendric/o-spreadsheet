import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component, useState } from "@odoo/owl";
import { getSelectedChartId, setChartBackgroundColor } from "../../../actions/chart_actions";
import { ColorPickerWidget } from "../../color_picker/color_picker_widget";
import { ToolBarDropdownStore, useToolBarDropdownStore } from "../../helpers/top_bar_tool_hook";

type Props = {
  icon: string;
  class: string;
  title: string;
};

export class ChartBackgroundColorEditor extends Component<Props, SpreadsheetChildEnv> {
  static components = { ColorPickerWidget };
  static props = { class: String, icon: String, title: String };

  static template = "o-spreadsheet-ColorEditor";
  topBarToolStore!: ToolBarDropdownStore;

  state = useState({
    isOpen: false,
  });

  setup() {
    this.topBarToolStore = useToolBarDropdownStore();
  }

  get currentColor(): string {
    const chartId = getSelectedChartId(this.env);
    if (!chartId) return "#ffffff";
    return this.env.model.getters.getChartDefinition(chartId).background || "#ffffff";
  }

  setColor(color: string) {
    setChartBackgroundColor(color)(this.env);
    this.state.isOpen = false;
  }

  get isMenuOpen(): boolean {
    return this.topBarToolStore.isActive;
  }

  onClick() {
    if (!this.isMenuOpen) {
      this.topBarToolStore.openDropdown();
    } else {
      this.topBarToolStore.closeDropdowns();
    }
  }
}
