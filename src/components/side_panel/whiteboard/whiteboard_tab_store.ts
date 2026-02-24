import { UID } from "@odoo/o-spreadsheet-engine/types/misc";
import { SpreadsheetStore } from "../../../stores";

export class WhiteboardTabStore extends SpreadsheetStore {
  mutators = ["openTab", "closeTab", "activateTab"] as const;

  openedTabs: UID[] = [];
  activeTab: UID | null = null;

  openTab(whiteboardId: UID) {
    if (!this.openedTabs.includes(whiteboardId)) {
      this.openedTabs.push(whiteboardId);
    }
    this.activeTab = whiteboardId;
  }

  closeTab(whiteboardId: UID) {
    this.openedTabs = this.openedTabs.filter((id) => id !== whiteboardId);
    if (this.activeTab === whiteboardId) {
      if (this.openedTabs.length > 0) {
        this.activeTab = this.openedTabs[0];
      } else {
        this.activeTab = null;
      }
    }
  }

  activateTab(whiteboardId: UID | null) {
    this.activeTab = whiteboardId;
  }

  handle(cmd: any) {
    switch (cmd.type) {
      case "DELETE_SHEET":
        this.closeTab(cmd.sheetId);
        break;
      case "RENAME_SHEET":
        // Nothing to do if we use UIDs, names are handled by getters
        break;
      case "ACTIVATE_SHEET":
        const whiteboardIds = this.getters.getWhiteboardSheetIds();
        if (!whiteboardIds.includes(cmd.sheetIdTo)) {
          this.activeTab = null;
        } else {
          this.activeTab = cmd.sheetIdTo;
        }
        break;
    }
  }
}
