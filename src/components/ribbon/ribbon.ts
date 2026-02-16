import { Component, onMounted, onWillUnmount, useEffect, useState } from "@odoo/owl";
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
    useEffect(
      () => {
        const tabs = this.tabs;
        if (!tabs.find((t) => t.id === this.state.activeTab)) {
          this.state.activeTab = "home";
        }
      },
      () => [this.tabs]
    );
    onMounted(() => this.env.model.on("update", this, this.render));
    onWillUnmount(() => this.env.model.off("update", this, this.render));
  }

  get tabs() {
    const tabs = ribbonRegistry.getTabs();
    return tabs.filter((t) => {
      const visible = !t.isVisible || t.isVisible(this.env as any);
      return visible;
    });
  }

  get activeGroups() {
    const groups = ribbonRegistry.getGroups(this.state.activeTab);
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter((i) => !i.isVisible || i.isVisible(this.env as any)),
      }))
      .filter((g) => g.items.length > 0);
  }

  selectTab(tabId: string) {
    this.state.activeTab = tabId;
  }
}
