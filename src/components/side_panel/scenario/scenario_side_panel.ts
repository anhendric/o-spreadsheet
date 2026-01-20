import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component, useState } from "@odoo/owl";
import { zoneToXc } from "../../../helpers";
import { SelectionInput } from "../../selection_input/selection_input";
import { Section } from "../components/section/section";
import { Scenario } from "./scenario_store";

interface Props {
  onCloseSidePanel: () => void;
}

interface ScenarioValue {
  xc: string;
  value: string;
}

export class ScenarioSidePanel extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-ScenarioSidePanel";
  static components = { SelectionInput, Section };
  static props = {
    onCloseSidePanel: Function,
  };

  private state!: {
    activeScenarioId: string | null;
    editingScenarioId: string | null;
    isEditing: boolean;
    editingName: string;
    editingCells: string[];
    editingValues: ScenarioValue[];
  };

  setup() {
    this.state = useState({
      activeScenarioId: null,
      editingScenarioId: null,
      isEditing: false,
      editingName: "",
      editingCells: [],
      editingValues: [],
    });
  }

  get scenarios() {
    return (this.env.model.getters as any).getScenarios() as Scenario[];
  }

  applyScenario(id: string) {
    this.env.model.dispatch("APPLY_SCENARIO" as any, { id });
    this.state.activeScenarioId = id;
  }

  deleteScenario(id: string) {
    this.env.model.dispatch("REMOVE_SCENARIO" as any, { id });
  }

  editScenario(id: string) {
    const scenario = this.scenarios.find((s) => s.id === id);
    if (!scenario) return;

    this.state.editingScenarioId = id;
    this.state.editingName = scenario.name;
    this.state.editingCells = Object.keys(scenario.cells);
    this.state.editingValues = Object.entries(scenario.cells).map(([xc, value]) => ({ xc, value }));
    this.state.isEditing = true;
  }

  openAddDialog() {
    // Pre-fill with current selection
    const zones = this.env.model.getters.getSelectedZones();
    const currentSelection = zones.map((z) => zoneToXc(z));

    this.state.isEditing = true;
    this.state.editingName = "New Scenario";
    this.state.editingCells = currentSelection;

    this.onEditingCellsChanged(currentSelection);
  }

  onEditingCellsChanged(ranges: string[]) {
    this.state.editingCells = ranges;

    if (!this.state.editingCells.length) {
      this.state.editingValues = [];
      return;
    }

    const sheetId = this.env.model.getters.getActiveSheetId();
    const values: ScenarioValue[] = [];
    let totalCells = 0;

    for (const rangeXc of this.state.editingCells) {
      const range = this.env.model.getters.getRangeFromSheetXC(sheetId, rangeXc);
      if (!range) continue;

      const zone = range.zone;
      const cellCount = (zone.bottom - zone.top + 1) * (zone.right - zone.left + 1);
      totalCells += cellCount;

      if (totalCells > 50) {
        // Too many cells, stop adding
        break;
      }

      for (let r = zone.top; r <= zone.bottom; r++) {
        for (let c = zone.left; c <= zone.right; c++) {
          const cell = this.env.model.getters.getCell({ sheetId, col: c, row: r });
          const xc = zoneToXc({ left: c, right: c, top: r, bottom: r });
          // Avoid duplicates if ranges overlap
          if (!values.find((v) => v.xc === xc)) {
            const val = cell ? cell.content || "" : "";
            values.push({ xc, value: val });
          }
        }
      }
    }
    this.state.editingValues = values;
  }

  saveScenario() {
    if (!this.state.editingName) return;

    const cellsData: Record<string, string> = {};
    for (const v of this.state.editingValues) {
      cellsData[v.xc] = v.value;
    }

    if (this.state.editingScenarioId) {
      this.env.model.dispatch("UPDATE_SCENARIO" as any, {
        id: this.state.editingScenarioId,
        name: this.state.editingName,
        cells: cellsData,
      });
    } else {
      this.env.model.dispatch("ADD_SCENARIO" as any, {
        name: this.state.editingName,
        cells: cellsData,
      });
    }
    this.cancelEdit();
  }

  cancelEdit() {
    this.state.isEditing = false;
    this.state.editingScenarioId = null;
    this.state.editingName = "";
    this.state.editingCells = [];
    this.state.editingValues = [];
  }
}
