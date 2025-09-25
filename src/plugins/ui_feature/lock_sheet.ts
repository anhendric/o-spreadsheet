import { Command, CommandResult, isSheetDependent } from "../../types/index";
import { UIPlugin } from "../ui_plugin";

export class LockSheetPlugin extends UIPlugin {
  allowDispatch(cmd: Command): CommandResult | CommandResult[] {
    if (isSheetDependent(cmd) && this.getters.isSheetLocked(cmd.sheetId)) {
      this.ui.raiseBlockingErrorUI("can'do that i'm afraid");
      return CommandResult.SheetLocked;
    }
    return CommandResult.Success;
  }
}
