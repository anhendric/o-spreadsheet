import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { ComponentConstructor } from "@odoo/owl";
import { PropsOf } from "../types/props_of";

export interface RibbonItem<C extends ComponentConstructor = ComponentConstructor> {
  id: string;
  component: C;
  props?: PropsOf<C>;
  sequence: number;
  isVisible?: (env: SpreadsheetChildEnv) => boolean;
}

export interface RibbonGroup {
  id: string;
  label: string;
  sequence: number;
  items: RibbonItem[];
}

export interface RibbonTab {
  id: string;
  name: string;
  sequence: number;
  groups: RibbonGroup[];
}

export class RibbonRegistry {
  private tabs: Map<string, RibbonTab> = new Map();

  addTab(id: string, name: string, sequence: number): this {
    if (this.tabs.has(id)) {
      throw new Error(`Tab ${id} already exists`);
    }
    this.tabs.set(id, { id, name, sequence, groups: [] });
    return this;
  }

  addGroup(tabId: string, groupId: string, label: string, sequence: number): this {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} does not exist`);
    }
    if (tab.groups.find((g) => g.id === groupId)) {
      throw new Error(`Group ${groupId} already exists in tab ${tabId}`);
    }
    tab.groups.push({ id: groupId, label, sequence, items: [] });
    return this;
  }

  addItem(tabId: string, groupId: string, item: RibbonItem): this {
    const tab = this.tabs.get(tabId);
    if (!tab) {
      throw new Error(`Tab ${tabId} does not exist`);
    }
    const group = tab.groups.find((g) => g.id === groupId);
    if (!group) {
      // Auto-create group if strictly necessary? No, explicit is better.
      throw new Error(`Group ${groupId} does not exist in tab ${tabId}`);
    }
    group.items.push(item);
    return this;
  }

  getTabs(): RibbonTab[] {
    return Array.from(this.tabs.values()).sort((a, b) => a.sequence - b.sequence);
  }

  getGroups(tabId: string): RibbonGroup[] {
    const tab = this.tabs.get(tabId);
    return tab ? tab.groups.sort((a, b) => a.sequence - b.sequence) : [];
  }
}

export const ribbonRegistry = new RibbonRegistry();
