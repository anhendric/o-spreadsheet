import { SpreadsheetStore } from "../../stores";
import { Command, UID } from "../../types";

export class SplitViewStore extends SpreadsheetStore {
  mutators = ["toggleSplitView", "setFocusedPane", "setLeftSheetId", "setRightSheetId"] as const;

  isSplitView: boolean = false;
  leftSheetId: UID | null = null;
  rightSheetId: UID | null = null;
  focusedPane: "left" | "right" = "left";

  toggleSplitView(sheetId: UID) {
    // Empêche la mutation si l’état est déjà correct
    if (
      this.isSplitView &&
      this.leftSheetId === null &&
      this.rightSheetId === null &&
      this.focusedPane === "left"
    ) {
      return;
    }
    if (
      !this.isSplitView &&
      this.leftSheetId === this.getters.getActiveSheetId() &&
      this.rightSheetId === sheetId &&
      this.focusedPane === "left"
    ) {
      return;
    }
    if (this.isSplitView) {
      this.isSplitView = false;
      this.leftSheetId = null;
      this.rightSheetId = null;
      this.focusedPane = "left";
    } else {
      this.isSplitView = true;
      this.leftSheetId = this.getters.getActiveSheetId();
      this.rightSheetId = sheetId;
      this.focusedPane = "left";
    }
  }

  setFocusedPane(pane: "left" | "right") {
    if (this.focusedPane === pane) {
      return;
    }
    this.focusedPane = pane;
  }

  setLeftSheetId(sheetId: UID) {
    this.leftSheetId = sheetId;
  }

  setRightSheetId(sheetId: UID) {
    this.rightSheetId = sheetId;
  }

  protected handle(cmd: Command) {
    if (cmd.type === "ACTIVATE_SHEET") {
      const sheetId = cmd.sheetIdTo;
      if (this.isSplitView) {
        if (this.focusedPane === "left") {
          this.leftSheetId = sheetId;
        } else if (this.focusedPane === "right") {
          this.rightSheetId = sheetId;
        }
      }
    }
  }
}
