import { CommandResult, CoreCommand } from "../../types/commands";
import { UID } from "../../types/misc";
import { CorePlugin } from "../core_plugin";

export interface Whiteboard {
  id: UID;
  name: string;
}

export class WhiteboardPlugin extends CorePlugin<{}> {
  static getters = ["getWhiteboards", "getWhiteboard"] as const;

  allowDispatch(cmd: CoreCommand) {
    return CommandResult.Success;
  }

  handle(cmd: CoreCommand) {}

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  getWhiteboards(): Whiteboard[] {
    return this.getters.getWhiteboardSheetIds().map((id) => ({
      id,
      name: this.getters.getSheetName(id),
    }));
  }

  getWhiteboard(id: UID): Whiteboard | undefined {
    const ids = this.getters.getWhiteboardSheetIds();
    if (ids.includes(id)) {
      return {
        id,
        name: this.getters.getSheetName(id),
      };
    }
    return undefined;
  }
}
