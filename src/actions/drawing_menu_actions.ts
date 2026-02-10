import { _t } from "@odoo/o-spreadsheet-engine/translation";
import { UID } from "@odoo/o-spreadsheet-engine/types/misc";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Action, ActionSpec, createActions } from "./action";

export function getDrawingMenuActions(figureId: UID, env: SpreadsheetChildEnv): Action[] {
  const menuItemSpecs: ActionSpec[] = [
    {
      id: "export_image",
      name: _t("Save as image"),
      icon: "o-spreadsheet-Icon.DOWNLOAD",
      execute: async () => {
        const root = document.querySelector(`.o-drawing-figure[data-figure-id="${figureId}"]`);
        if (root) {
          const clone = root.cloneNode(true) as HTMLElement;
          const handles = clone.querySelectorAll(".o-resize-handle, .dashed-box");
          handles.forEach((h) => h.remove());

          const width = root.clientWidth;
          const height = root.clientHeight;
          const data = new XMLSerializer().serializeToString(clone);

          const drawing = env.model.getters.getDrawing(figureId);
          const bg = drawing?.backgroundColor || "transparent";

          const svg = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                        <foreignObject width="100%" height="100%">
                            <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; position:relative; background-color: ${bg}">
                                ${data}
                            </div>
                        </foreignObject>
                    </svg>
                `;

          const img = new Image();
          const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (ctx) {
              ctx.drawImage(img, 0, 0);
              const link = document.createElement("a");
              link.download = `drawing-${figureId}.png`;
              link.href = canvas.toDataURL("image/png");
              link.click();
            }
          };
          img.src = url;
        }
      },
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
  return createActions(menuItemSpecs);
}
