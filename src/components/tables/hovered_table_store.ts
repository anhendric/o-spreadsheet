import { PositionMap } from "@odoo/o-spreadsheet-engine/helpers/cells/position_map";
import { SpreadsheetStore } from "../../stores";
import { Color, Command, Position } from "../../types";

export class HoveredTableStore extends SpreadsheetStore {
  mutators = ["clear", "hover"] as const;

  col: number | undefined;
  row: number | undefined;

  overlayColors: PositionMap<Color> = new PositionMap();

  handle(cmd: Command) {
    switch (cmd.type) {
      case "ACTIVATE_SHEET":
        this.clear();
    }
  }

  hover(position: Partial<Position>) {
    return "noStateChange";
  }

  clear() {
    this.col = undefined;
    this.row = undefined;
  }
}
