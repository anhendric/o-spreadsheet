import { Component, useState } from "@odoo/owl";
import { ribbonRegistry } from "../../registries/ribbon_registry";

export class Ribbon extends Component {
  static template = "o-spreadsheet-Ribbon";
  static props = { slots: Object };

  state = useState({ activeTab: "home" });

  setup() {
    // Ensure we have a valid active tab on start
    const tabs = this.tabs;
    if (tabs.length > 0 && !tabs.find((t) => t.id === this.state.activeTab)) {
      this.state.activeTab = tabs[0].id;
    }
  }

  get tabs() {
    return ribbonRegistry.getTabs();
  }

  get activeGroups() {
    return ribbonRegistry.getGroups(this.state.activeTab);
  }

  selectTab(tabId: string) {
    this.state.activeTab = tabId;
  }
}
