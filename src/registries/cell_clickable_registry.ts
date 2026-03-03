import { openLink } from "@odoo/o-spreadsheet-engine/helpers/links";
import { Registry } from "@odoo/o-spreadsheet-engine/registries/registry";
import { _t } from "@odoo/o-spreadsheet-engine/translation";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { ComponentConstructor } from "@odoo/owl";
import { CellPosition, Getters } from "../types";

export interface CellClickableItem {
  condition: (position: CellPosition, getters: Getters) => boolean;
  execute: (position: CellPosition, env: SpreadsheetChildEnv, isMiddleClick?: boolean) => void;
  title?: string | ((position: CellPosition, getters: Getters) => string);
  sequence: number;
  component?: ComponentConstructor;
  componentProps?: (position: CellPosition, getters: Getters) => Record<string, unknown>;
}

export const clickableCellRegistry = new Registry<CellClickableItem>();

clickableCellRegistry.add("link", {
  condition: (position: CellPosition, getters: Getters) => {
    return !!getters.getEvaluatedCell(position).link;
  },
  execute: (position: CellPosition, env: SpreadsheetChildEnv, isMiddleClick?: boolean) =>
    openLink(env.model.getters.getEvaluatedCell(position).link!, env, isMiddleClick),
  title: (position, getters) => {
    const link = getters.getEvaluatedCell(position).link;
    if (!link) {
      return "";
    }
    if (link.isExternal) {
      return _t("Go to url: %(url)s", { url: link.url });
    } else {
      return _t("Go to %(label)s", { label: link.label });
    }
  },
  sequence: 5,
});
