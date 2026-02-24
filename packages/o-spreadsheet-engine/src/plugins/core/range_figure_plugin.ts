import {
  CommandResult,
  CoreCommand,
  CreateRangeFigureCommand,
  UpdateRangeFigureCommand,
} from "../../types/commands";
import { UID } from "../../types/misc";
import { RangeData } from "../../types/range";
import { WorkbookData } from "../../types/workbook_data";
import { CorePlugin } from "../core_plugin";

export interface RangeFigureDefinition {
  range: RangeData;
  displayMode: "fit" | "actual";
}

interface RangeFigureState {
  readonly rangeFigures: Record<UID, Record<UID, RangeFigureDefinition | undefined> | undefined>;
}

export class RangeFigurePlugin extends CorePlugin<RangeFigureState> implements RangeFigureState {
  static getters = ["getRangeFigure"] as const;
  readonly rangeFigures: Record<UID, Record<UID, RangeFigureDefinition | undefined> | undefined> =
    {};

  // ---------------------------------------------------------------------------
  // Command Handling
  // ---------------------------------------------------------------------------

  allowDispatch(cmd: CoreCommand) {
    switch (cmd.type) {
      case "CREATE_RANGE_FIGURE":
        if (this.getters.getFigure(cmd.sheetId, cmd.figureId)) {
          return CommandResult.InvalidFigureId;
        }
        return CommandResult.Success;
      case "UPDATE_RANGE_FIGURE":
        if (!this.getters.getFigure(cmd.sheetId, cmd.figureId)) {
          return CommandResult.FigureDoesNotExist;
        }
        return CommandResult.Success;
      default:
        return CommandResult.Success;
    }
  }

  handle(cmd: CoreCommand) {
    switch (cmd.type) {
      case "CREATE_RANGE_FIGURE": {
        const { figureId, sheetId, col, row, offset, size, range, displayMode } =
          cmd as CreateRangeFigureCommand;
        if (!this.getters.getFigure(sheetId, figureId)) {
          this.dispatch("CREATE_FIGURE", {
            sheetId,
            figureId,
            col,
            row,
            offset,
            size,
            tag: "range",
          });
        }
        this.history.update("rangeFigures", sheetId, figureId, { range, displayMode });
        break;
      }
      case "UPDATE_RANGE_FIGURE": {
        const { figureId, sheetId, range, displayMode } = cmd as UpdateRangeFigureCommand;
        const current = this.rangeFigures[sheetId]?.[figureId];
        if (current) {
          this.history.update("rangeFigures", sheetId, figureId, {
            range: range || current.range,
            displayMode: displayMode || current.displayMode,
          });
        }
        break;
      }
      case "DELETE_FIGURE":
        this.history.update("rangeFigures", cmd.sheetId, cmd.figureId, undefined);
        break;
      case "DELETE_SHEET":
        this.history.update("rangeFigures", cmd.sheetId, undefined);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  getRangeFigure(figureId: UID): RangeFigureDefinition | undefined {
    for (const sheet of Object.values(this.rangeFigures)) {
      if (sheet && sheet[figureId]) {
        return sheet[figureId];
      }
    }
    return undefined;
  }

  // ---------------------------------------------------------------------------
  // Import/Export
  // ---------------------------------------------------------------------------

  import(data: WorkbookData) {
    for (const sheet of data.sheets) {
      const rangeFigures = (sheet.figures || []).filter((figure) => figure.tag === "range");
      for (const fig of rangeFigures) {
        this.history.update("rangeFigures", sheet.id, fig.id, fig.data);
      }
    }
  }

  export(data: WorkbookData) {
    for (const sheet of data.sheets) {
      const rangeFigures = sheet.figures.filter((figure) => figure.tag === "range");
      for (const fig of rangeFigures) {
        fig.data = this.rangeFigures[sheet.id]?.[fig.id];
      }
    }
  }
}
