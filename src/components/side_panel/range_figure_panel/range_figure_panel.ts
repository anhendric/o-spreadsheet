import { _t } from "@odoo/o-spreadsheet-engine/translation";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component } from "@odoo/owl";
import { UID } from "../../../types";
import { SelectionInput } from "../../selection_input/selection_input";
import { RadioSelection } from "../components/radio_selection/radio_selection";
import { Section } from "../components/section/section";

interface Props {
  figureId: UID;
  onCloseSidePanel?: Function;
}

export class RangeFigurePanel extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-RangeFigurePanel";
  static components = { SelectionInput, Section, RadioSelection };
  static props = {
    figureId: String,
    onCloseSidePanel: { type: Function, optional: true },
  };

  get definition() {
    return this.env.model.getters.getRangeFigure(this.props.figureId);
  }

  get ranges() {
    const def = this.definition;
    if (!def) {
      return [];
    }
    return [
      this.env.model.getters.getRangeString(
        this.env.model.getters.getRangeFromRangeData(def.range),
        this.env.model.getters.getActiveSheetId()
      ),
    ];
  }

  get displayModeChoices() {
    return [
      { value: "fit", label: _t("Fit to content") },
      { value: "actual", label: _t("Actual size") },
    ];
  }

  onRangeChanged(ranges: string[]) {
    const xc = ranges[0];
    if (xc) {
      const activeSheetId = this.env.model.getters.getActiveSheetId();
      const range = this.env.model.getters.getRangeDataFromXc(activeSheetId, xc);
      this.env.model.dispatch("UPDATE_RANGE_FIGURE", {
        figureId: this.props.figureId,
        sheetId: activeSheetId,
        range,
      });
    }
  }

  onDisplayModeChanged(displayMode: any) {
    this.env.model.dispatch("UPDATE_RANGE_FIGURE", {
      figureId: this.props.figureId,
      sheetId: this.env.model.getters.getActiveSheetId(),
      displayMode,
    });
  }
}
