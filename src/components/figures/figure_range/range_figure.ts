import { MIN_CELL_TEXT_MARGIN } from "@odoo/o-spreadsheet-engine/constants";
import { RangeFigureDefinition } from "@odoo/o-spreadsheet-engine/plugins/core/range_figure_plugin";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component, onMounted, useEffect, useRef } from "@odoo/owl";
import { computeTextFont } from "../../../helpers";
import { Rect, UID } from "../../../types";

interface Props {
  figureUI: {
    id: UID;
    tag: string;
    width: number;
    height: number;
  };
  editFigureStyle: (properties: Partial<CSSStyleDeclaration>) => void;
  openContextMenu: (anchorRect: Rect) => void;
}

export class RangeFigure extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-RangeFigure";
  private canvasRef = useRef("canvas");
  static props = {
    figureUI: Object,
    editFigureStyle: Function,
    openContextMenu: Function,
  };

  get definition(): RangeFigureDefinition | undefined {
    return (this.env.model.getters as any).getRangeFigure(this.props.figureUI.id);
  }

  setup() {
    onMounted(() => this.draw());
    useEffect(() => this.draw());
  }

  onDoubleClick() {
    this.env.openSidePanel("RangeFigurePanel", { figureId: this.props.figureUI.id });
  }

  draw() {
    const canvas = this.canvasRef.el as HTMLCanvasElement;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const def = this.definition;
    if (!def) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const { sheetId, zone } = this.env.model.getters.getRangeFromRangeData(def.range);
    const zoneRect = this.env.model.getters.getRect(zone);

    const dpi = window.devicePixelRatio || 1;
    if (def.displayMode === "fit") {
      canvas.width = this.props.figureUI.width * dpi;
      canvas.height = this.props.figureUI.height * dpi;
    } else {
      canvas.width = zoneRect.width * dpi;
      canvas.height = zoneRect.height * dpi;
    }
    canvas.style.width = canvas.width / dpi + "px";
    canvas.style.height = canvas.height / dpi + "px";

    ctx.scale(dpi, dpi);

    if (def.displayMode === "fit") {
      const scaleX = this.props.figureUI.width / zoneRect.width;
      const scaleY = this.props.figureUI.height / zoneRect.height;
      const scale = Math.min(scaleX, scaleY);
      ctx.scale(scale, scale);
    }

    ctx.clearRect(0, 0, zoneRect.width, zoneRect.height);
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, zoneRect.width, zoneRect.height);

    for (let row = zone.top; row <= zone.bottom; row++) {
      for (let col = zone.left; col <= zone.right; col++) {
        const position = { sheetId, col, row };
        const merge = this.env.model.getters.getMerge(position);
        if (merge && (merge.left !== col || merge.top !== row)) {
          continue;
        }

        const cellZone = merge || { left: col, right: col, top: row, bottom: row };
        const rect = this.env.model.getters.getRect(cellZone);
        const x = rect.x - zoneRect.x;
        const y = rect.y - zoneRect.y;

        this.drawCell(ctx, position, { x, y, width: rect.width, height: rect.height });
      }
    }
  }

  drawCell(
    ctx: CanvasRenderingContext2D,
    position: { sheetId: UID; col: number; row: number },
    rect: Rect
  ) {
    const style = this.env.model.getters.getCellComputedStyle(position);

    // Background
    if (style.fillColor && style.fillColor !== "#ffffff") {
      ctx.fillStyle = style.fillColor;
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    }

    // Border (Simplified: draw thin grey line)
    ctx.strokeStyle = "#e0e0e0";
    ctx.lineWidth = 0.5;
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    // Text
    const cellValue = this.env.model.getters.getEvaluatedCell(position);
    if (cellValue.value) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.width, rect.height);
      ctx.clip();

      ctx.fillStyle = style.textColor || "black";
      ctx.font = computeTextFont(style);
      ctx.textBaseline = "middle";
      const align = (style.align || cellValue.defaultAlign) as any;
      ctx.textAlign = align || "left";

      let tx = rect.x;
      if (ctx.textAlign === "left") {
        tx += MIN_CELL_TEXT_MARGIN;
      } else if (ctx.textAlign === "right") {
        tx += rect.width - MIN_CELL_TEXT_MARGIN;
      } else if (ctx.textAlign === "center") {
        tx += rect.width / 2;
      }

      ctx.fillText(cellValue.formattedValue, tx, rect.y + rect.height / 2);
      ctx.restore();
    }
  }
}
