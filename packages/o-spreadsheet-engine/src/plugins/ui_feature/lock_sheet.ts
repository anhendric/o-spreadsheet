import {
  Command,
  CommandResult,
  isCoreCommand,
  lockedSheetAllowedCommands,
} from "../../types/commands";
import { UIPlugin } from "../ui_plugin";

export class LockSheetPlugin extends UIPlugin {
  static getters = ["isCurrentSheetLocked"] as const;

  allowDispatch(cmd: Command): CommandResult | CommandResult[] {
    if (lockedSheetAllowedCommands.has(cmd.type)) {
      return CommandResult.Success;
    }
    if (
      ("sheetId" in cmd && this.getters.isSheetLocked(cmd.sheetId)) ||
      (!isCoreCommand(cmd) && this.isCurrentSheetLocked())
    ) {
      return CommandResult.SheetLocked;
    }
    return CommandResult.Success;
  }

  isCurrentSheetLocked() {
    return this.getters.isSheetLocked(this.getters.getActiveSheetId());
  }
}
