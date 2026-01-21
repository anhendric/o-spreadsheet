import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component, useState } from "@odoo/owl";
import { zoneToXc } from "../../../helpers";
import { Store, useLocalStore } from "../../../store_engine";
import { SelectionInput } from "../../selection_input/selection_input";
import { SidePanelCollapsible } from "../components/collapsible/side_panel_collapsible";
import { Section } from "../components/section/section";
import { GoalSeekAlgorithm, GoalSeekStore } from "./goal_seek_store";

interface Props {
  onCloseSidePanel: () => void;
}

export class GoalSeekSidePanel extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-GoalSeekPanel";
  static components = { SelectionInput, Section, SidePanelCollapsible };
  static props = {
    onCloseSidePanel: Function,
  };

  private store!: Store<GoalSeekStore>;
  private state!: {
    setCell: string;
    toValue: number;
    byChangingCell: string;
    algorithm: GoalSeekAlgorithm;
    epsilon: number;
    minValue?: number;
    maxValue?: number;
  };

  setup() {
    this.store = useLocalStore(GoalSeekStore);
    const activePosition = this.env.model.getters.getActivePosition();
    const activeXc = zoneToXc({
      left: activePosition.col,
      right: activePosition.col,
      top: activePosition.row,
      bottom: activePosition.row,
    });

    this.state = useState({
      setCell: activeXc,
      toValue: 0,
      byChangingCell: "",
      algorithm: "Secant",
      epsilon: 1e-7,
      minValue: undefined,
      maxValue: undefined,
    });
  }

  onSetCellChanged(ranges: string[]) {
    this.state.setCell = ranges[0] || "";
  }

  onByChangingCellChanged(ranges: string[]) {
    this.state.byChangingCell = ranges[0] || "";
  }

  start() {
    if (!this.state.setCell || !this.state.byChangingCell) {
      return;
    }
    const sheetId = this.env.model.getters.getActiveSheetId();
    const setCellRange = this.env.model.getters.getRangeFromSheetXC(sheetId, this.state.setCell);
    const byChangingCellRange = this.env.model.getters.getRangeFromSheetXC(
      sheetId,
      this.state.byChangingCell
    );

    if (!setCellRange || !byChangingCellRange) return;

    // Parse bounds, handling empty string or undefined as undefined
    const minVal =
      this.state.minValue === undefined || (this.state.minValue as any) === ""
        ? undefined
        : Number(this.state.minValue);
    const maxVal =
      this.state.maxValue === undefined || (this.state.maxValue as any) === ""
        ? undefined
        : Number(this.state.maxValue);

    this.store.goalSeek(
      { sheetId: setCellRange.sheetId, col: setCellRange.zone.left, row: setCellRange.zone.top },
      Number(this.state.toValue),
      {
        sheetId: byChangingCellRange.sheetId,
        col: byChangingCellRange.zone.left,
        row: byChangingCellRange.zone.top,
      },
      this.state.algorithm,
      Number(this.state.epsilon) || 1e-7,
      minVal,
      maxVal
    );
  }
}
