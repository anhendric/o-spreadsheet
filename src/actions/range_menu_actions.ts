import { _t } from "@odoo/o-spreadsheet-engine/translation";
import { UID } from "@odoo/o-spreadsheet-engine/types/misc";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Action, ActionSpec, createActions } from "./action";

export function getRangeMenuActions(figureId: UID, env: SpreadsheetChildEnv): Action[] {
  const menuItemSpecs: ActionSpec[] = [
    {
      id: "edit",
      name: _t("Edit"),
      execute: () => {
        env.model.dispatch("SELECT_FIGURE", { figureId });
        env.openSidePanel("RangeFigurePanel", { figureId });
      },
      icon: "o-spreadsheet-Icon.EDIT",
      isEnabled: (env) => !env.isSmall,
    },
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
  return createActions(menuItemSpecs).filter((action) =>
    env.model.getters.isReadonly() ? action.isReadonlyAllowed : true
  );
}
