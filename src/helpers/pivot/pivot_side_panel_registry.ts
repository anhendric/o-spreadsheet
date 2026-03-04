import { Registry } from "@odoo/o-spreadsheet-engine/registries/registry";
import { Component } from "@odoo/owl";
import { PivotSpreadsheetSidePanel } from "../../components/side_panel/pivot/pivot_side_panel/pivot_spreadsheet_side_panel/pivot_spreadsheet_side_panel";

export const pivotSidePanelRegistry = new Registry<{
  editor: new (...args: any) => Component;
}>();

pivotSidePanelRegistry.add("SPREADSHEET", {
  editor: PivotSpreadsheetSidePanel,
});
