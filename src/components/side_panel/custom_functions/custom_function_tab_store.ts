import { SpreadsheetStore } from "../../../stores";

export class CustomFunctionTabStore extends SpreadsheetStore {
  mutators = ["openTab", "closeTab", "activateTab"] as const;

  openedTabs: string[] = [];
  activeTab: string | null = null;

  openTab(functionName: string) {
    if (!this.openedTabs.includes(functionName)) {
      this.openedTabs.push(functionName);
    }
    this.activeTab = functionName;
  }

  closeTab(functionName: string) {
    this.openedTabs = this.openedTabs.filter((name) => name !== functionName);
    if (this.activeTab === functionName) {
      if (this.openedTabs.length > 0) {
        this.activeTab = this.openedTabs[0];
      } else {
        this.activeTab = null;
      }
    }
  }

  activateTab(functionName: string | null) {
    this.activeTab = functionName;
  }

  handleEvent(event: any) {
    if (event.type === "REMOVE_CUSTOM_FUNCTION") {
      this.closeTab(event.name);
    } else if (event.type === "RENAME_CUSTOM_FUNCTION") {
      if (this.openedTabs.includes(event.name)) {
        const index = this.openedTabs.indexOf(event.name);
        this.openedTabs[index] = event.newName;
        if (this.activeTab === event.name) {
          this.activeTab = event.newName;
        }
      }
    } else if (event.type === "ACTIVATE_SHEET") {
      this.activeTab = null;
    }
  }
}
