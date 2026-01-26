import { _t } from "@odoo/o-spreadsheet-engine/translation";
import { UID } from "@odoo/o-spreadsheet-engine/types/misc";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Action, ActionSpec, createActions } from "./action";

export function getLatexMenuActions(figureId: UID, env: SpreadsheetChildEnv): Action[] {
  const menuItemSpecs: ActionSpec[] = [
    {
      id: "delete",
      name: _t("Delete"),
      execute: () => {
        env.model.dispatch("DELETE_FIGURE", {
          sheetId: env.model.getters.getActiveSheetId(),
          figureId,
        });
      },
      icon: "o-spreadsheet-Icon.TRASH",
    },
  ];
  return createActions(menuItemSpecs);
}
