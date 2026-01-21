import { UIPlugin } from "@odoo/o-spreadsheet-engine/plugins/ui_plugin";
import { Command, CommandResult } from "../../../types";

// Simple UUID generator to avoid import issues
function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0,
      v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface Scenario {
  id: string;
  name: string;
  cells: Record<string, string>;
}

export class ScenarioPlugin extends UIPlugin {
  static getters = ["getScenarios"] as const;
  static layers = [];

  private scenarios: Scenario[] = [];

  // ---------------------------------------------------------------------------
  // Command Handling
  // ---------------------------------------------------------------------------

  allowDispatch(cmd: Command) {
    return CommandResult.Success;
  }

  handle(cmd: Command) {
    switch (cmd.type) {
      case "ADD_SCENARIO" as any:
        this.addScenario((cmd as any).name, (cmd as any).cells);
        break;
      case "REMOVE_SCENARIO" as any:
        this.removeScenario((cmd as any).id);
        break;
      case "APPLY_SCENARIO" as any:
        this.applyScenario((cmd as any).id);
        break;
      case "UPDATE_SCENARIO" as any:
        this.updateScenario((cmd as any).id, (cmd as any).name, (cmd as any).cells);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  getScenarios(): Scenario[] {
    return this.scenarios;
  }

  // ---------------------------------------------------------------------------
  // Private / Internal
  // ---------------------------------------------------------------------------

  private addScenario(name: string, cells: Record<string, string>) {
    const id = uuid();
    this.scenarios.push({ id, name, cells });
  }

  private updateScenario(id: string, name: string, cells: Record<string, string>) {
    const index = this.scenarios.findIndex((s) => s.id === id);
    if (index >= 0) {
      this.scenarios[index] = { id, name, cells };
    }
  }

  private removeScenario(id: string) {
    this.scenarios = this.scenarios.filter((s) => s.id !== id);
  }

  private applyScenario(id: string) {
    const scenario = this.scenarios.find((s) => s.id === id);
    if (!scenario) return;

    const sheetId = this.getters.getActiveSheetId();

    for (const [xc, content] of Object.entries(scenario.cells)) {
      const range = this.getters.getRangeFromSheetXC(sheetId, xc);
      if (range) {
        this.dispatch("UPDATE_CELL", {
          sheetId,
          col: range.zone.left,
          row: range.zone.top,
          content: content,
        });
      }
    }
  }
}
