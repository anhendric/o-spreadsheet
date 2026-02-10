import { DrawingData, DrawingElement } from "@odoo/o-spreadsheet-engine/plugins/ui_feature/drawing";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component, markup, useRef, useState } from "@odoo/owl";
import { CSSProperties, FigureUI, Rect } from "../../../types";

interface Props {
  figureUI: FigureUI;
  editFigureStyle?: (properties: CSSProperties) => void;
  openContextMenu?: (anchorRect: Rect, onClose?: () => void) => void;
}

interface DragState {
  mode: "move" | "resize" | "point";
  elementId: string;
  startX: number;
  startY: number;
  initialElement: DrawingElement;
  resizeHandle?: "tl" | "tr" | "bl" | "br";
  pointIndex?: number;
}

export class DrawingFigure extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-DrawingFigure";
  static props = {
    figureUI: Object,
    editFigureStyle: { type: Function, optional: true },
    openContextMenu: { type: Function, optional: true },
  };

  get figureStyle(): string {
    const { backgroundColor } = this.drawingData || {};
    return `background-color: ${backgroundColor || "transparent"};`;
  }

  private dragState: DragState | null = null;
  state = useState({
    selectedElementId: null as string | null,
    tempElement: null as DrawingElement | null, // Used for rendering during drag
  });

  rootRef = useRef("root");

  get drawingData(): DrawingData | undefined {
    return this.env.model.getters.getDrawing(this.props.figureUI.id);
  }

  get drawingElements(): DrawingElement[] {
    const elements = this.drawingData?.elements || [];
    // If dragging, replace the element with the temp one
    if (this.state.tempElement) {
      return elements.map((e) =>
        e.id === this.state.tempElement!.id ? this.state.tempElement! : e
      );
    }
    return elements;
  }

  snapToGrid(val: number): number {
    const gridSize = this.drawingData?.gridSize || 20;
    return Math.round(val / gridSize) * gridSize;
  }

  onPointerDown(
    ev: PointerEvent,
    elementId: string,
    type: "element" | "handle" | "point",
    handleOrIndex?: string | number
  ) {
    ev.stopPropagation(); // Prevent figure drag if clicking on element
    const element = this.drawingData?.elements.find((e) => e.id === elementId);
    if (!element) return;

    // Dispatch selection update
    if (this.drawingData?.selectedElementId !== elementId) {
      this.env.model.dispatch("SELECT_DRAWING_ELEMENT", {
        figureId: this.props.figureUI.id,
        elementId: elementId,
      });
    }

    let mode: DragState["mode"];
    let resizeHandle: DragState["resizeHandle"] = undefined;
    let pointIndex: number | undefined = undefined;

    if (type === "point") {
      mode = "point";
      pointIndex = handleOrIndex as number;
    } else if (type === "handle") {
      mode = "resize";
      resizeHandle = handleOrIndex as any;
    } else {
      mode = "move";
    }

    this.dragState = {
      mode,
      elementId,
      startX: ev.clientX,
      startY: ev.clientY,
      initialElement: JSON.parse(JSON.stringify(element)), // Deep copy for points
      resizeHandle,
      pointIndex,
    };

    // Capture pointer
    (ev.target as Element).setPointerCapture(ev.pointerId);
  }

  onPointerMove(ev: PointerEvent) {
    if (!this.dragState) return;

    const { startX, startY, initialElement, mode, resizeHandle, pointIndex } = this.dragState;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;

    const newElement = JSON.parse(JSON.stringify(initialElement)) as DrawingElement;

    if (mode === "move") {
      // Move entire element
      // For points-based elements (lines), move all points
      if (newElement.points) {
        newElement.points = newElement.points.map((p) => ({
          x: this.snapToGrid(initialElement.points![newElement.points!.indexOf(p)].x + dx), // Logic is flawed here with map index, but since we deep copied, we can iterate original
          y: this.snapToGrid(initialElement.points![newElement.points!.indexOf(p)].y + dy),
        }));
        // Fix: use index to match initial
        newElement.points = initialElement.points!.map((p) => ({
          x: this.snapToGrid(p.x + dx),
          y: this.snapToGrid(p.y + dy),
        }));
      } else {
        newElement.x = this.snapToGrid(initialElement.x + dx);
        newElement.y = this.snapToGrid(initialElement.y + dy);
      }
    } else if (mode === "point" && pointIndex !== undefined && newElement.points) {
      // Move specific point
      newElement.points[pointIndex].x = this.snapToGrid(initialElement.points![pointIndex].x + dx);
      newElement.points[pointIndex].y = this.snapToGrid(initialElement.points![pointIndex].y + dy);
    } else if (mode === "resize" && resizeHandle && !newElement.points) {
      // Resize box-based elements
      if (resizeHandle.includes("l")) {
        newElement.x = Math.min(initialElement.x + dx, initialElement.x + initialElement.width - 5);
        newElement.width = initialElement.width - (newElement.x - initialElement.x);
      }
      if (resizeHandle.includes("r")) {
        newElement.width = Math.max(5, initialElement.width + dx);
      }
      if (resizeHandle.includes("t")) {
        newElement.y = Math.min(
          initialElement.y + dy,
          initialElement.y + initialElement.height - 5
        );
        newElement.height = initialElement.height - (newElement.y - initialElement.y);
      }
      if (resizeHandle.includes("b")) {
        newElement.height = Math.max(5, initialElement.height + dy);
      }

      newElement.x = this.snapToGrid(newElement.x);
      newElement.y = this.snapToGrid(newElement.y);
      newElement.width = this.snapToGrid(newElement.width);
      newElement.height = this.snapToGrid(newElement.height);
    }

    // For points elements, we might want to update bbox (x,y,w,h) for compatibility, though rendering should use points.
    // But for now let's just keep x,y as top-left of bbox?
    if (newElement.points) {
      const xs = newElement.points.map((p) => p.x);
      const ys = newElement.points.map((p) => p.y);
      newElement.x = Math.min(...xs);
      newElement.y = Math.min(...ys);
      newElement.width = Math.max(...xs) - newElement.x;
      newElement.height = Math.max(...ys) - newElement.y;
    }

    this.state.tempElement = newElement;
  }

  onPointerUp(ev: PointerEvent) {
    if (!this.dragState) return;

    // Dispatch final update
    if (this.state.tempElement) {
      const updates: Partial<DrawingElement> = {};
      if (this.state.tempElement.points) {
        updates.points = this.state.tempElement.points;
        updates.x = this.state.tempElement.x;
        updates.y = this.state.tempElement.y;
        updates.width = this.state.tempElement.width;
        updates.height = this.state.tempElement.height;
      } else {
        updates.x = this.state.tempElement.x;
        updates.y = this.state.tempElement.y;
        updates.width = this.state.tempElement.width;
        updates.height = this.state.tempElement.height;
      }

      this.env.model.dispatch("UPDATE_DRAWING_ELEMENT", {
        figureId: this.props.figureUI.id,
        elementId: this.dragState.elementId,
        updates,
      });
    }

    this.dragState = null;
    this.state.tempElement = null;
    (ev.target as Element).releasePointerCapture(ev.pointerId);
  }

  onDoubleClick() {
    // Selection is handled on pointer down now.
    // Double click just ensures panel is open.
    this.env.model.dispatch("SELECT_FIGURE", { figureId: this.props.figureUI.id });
    this.env.openSidePanel("DrawingSidePanel");
  }

  onClickBackground(ev: MouseEvent) {
    // If clicking on background (and not stopped by element), deselect
    this.env.model.dispatch("SELECT_DRAWING_ELEMENT", {
      figureId: this.props.figureUI.id,
      elementId: null,
    });
  }

  getStyle(element: DrawingElement): string {
    const style = element.style;
    const isSelected = this.isElementSelected(element.id);

    let borderStyle = "solid";
    let borderWidth = "1px";

    if (style.borderStyle === "thin") {
      borderWidth = "1px";
    } else if (style.borderStyle === "medium") {
      borderWidth = "2px";
    } else if (style.borderStyle === "thick") {
      borderWidth = "3px";
    } else if (style.borderStyle === "dashed") {
      borderStyle = "dashed";
    } else if (style.borderStyle === "dotted") {
      borderStyle = "dotted";
    } else if (style.strokeWidth !== undefined) {
      borderWidth = `${style.strokeWidth}px`;
    }

    const border = isSelected
      ? `2px dashed #0099ff`
      : `${borderWidth} ${borderStyle} ${style.strokeColor || "black"}`;

    return `
          background-color: ${style.fillColor || "transparent"};
          border: ${border};
          box-sizing: border-box; 
          z-index: 1;
      `;
  }

  getPositionStyle(element: DrawingElement): string {
    let left, top, width, height;
    if (element.points) {
      const xs = element.points.map((p) => p.x);
      const ys = element.points.map((p) => p.y);
      left = Math.min(...xs);
      top = Math.min(...ys);
      width = Math.max(...xs) - left;
      height = Math.max(...ys) - top;

      // Ensure minimum size for visibility of lines that are perfectly vertical or horizontal
      // The SVG overflow:visible captures the stroke, but if the container is 0px,
      // some browsers might have issues or interactions might fail.
      // Also, we shift the container if we expand it? No, just expand.
      // Actually, if we just set min-width/height, it expands to the right/bottom.
      // This is arguably fine as `overflow: visible` handles the rest, but 0px size is risky.
      if (width === 0) width = 1;
      if (height === 0) height = 22;
    } else {
      left = Math.min(element.x, element.x + element.width);
      top = Math.min(element.y, element.y + element.height);
      width = Math.abs(element.width);
      height = Math.abs(element.height);
    }
    return `left: ${left}px; top: ${top}px; width: ${width}px; height: ${height}px;`;
  }

  getBounds(element: DrawingElement): { left: number; top: number } {
    if (element.points) {
      const xs = element.points.map((p) => p.x);
      const ys = element.points.map((p) => p.y);
      return { left: Math.min(...xs), top: Math.min(...ys) };
    }
    return {
      left: Math.min(element.x, element.x + element.width),
      top: Math.min(element.y, element.y + element.height),
    };
  }

  getSvgStyle(element: DrawingElement): { strokeWidth: number; strokeDasharray?: string } {
    const style = element.style;
    let strokeWidth = 1;
    let strokeDasharray: string | undefined = undefined;

    if (style.borderStyle === "thin") {
      strokeWidth = 1;
    } else if (style.borderStyle === "medium") {
      strokeWidth = 2;
    } else if (style.borderStyle === "thick") {
      strokeWidth = 3;
    } else if (style.borderStyle === "dashed") {
      strokeWidth = 1;
      strokeDasharray = "3, 3";
    } else if (style.borderStyle === "dotted") {
      strokeWidth = 1;
      strokeDasharray = "1, 1";
    } else if (style.strokeWidth !== undefined) {
      strokeWidth = style.strokeWidth;
    }

    return { strokeWidth, strokeDasharray };
  }

  getTextStyle(element: DrawingElement): string {
    const { style } = element;
    const fontSize = style.fontSize
      ? `${style.fontSize}px`
      : style.strokeWidth
      ? `${style.strokeWidth * 5}px`
      : "16px";
    const color = style.textColor || "#000000";
    const backgroundColor = style.fillColor || "transparent"; // Background from TextStyler (fillColor)

    const alignItems =
      style.verticalAlign === "top"
        ? "flex-start"
        : style.verticalAlign === "bottom"
        ? "flex-end"
        : "center";
    const justifyContent =
      style.align === "left" ? "flex-start" : style.align === "right" ? "flex-end" : "center";
    const textAlign = style.align || "center";

    return `
            display: flex;
            align-items: ${alignItems};
            justify-content: ${justifyContent};
            text-align: ${textAlign};
            color: ${color};
            background-color: ${backgroundColor};
            font-size: ${fontSize};
            font-weight: ${style.bold ? "bold" : "normal"};
            font-style: ${style.italic ? "italic" : "normal"};
            text-decoration: ${style.underline ? "underline" : "none"};
            width: 100%;
            height: 100%;
            white-space: pre-wrap;
            overflow: hidden;
        `;
  }

  getSvgContent(element: DrawingElement) {
    if (!element.svgContent) return "";
    return markup(element.svgContent);
  }

  async exportDrawing() {
    const root = this.rootRef.el;
    if (!root) return;

    // Clone the node to avoid modifying the visible DOM
    const clone = root.cloneNode(true) as HTMLElement;

    // Remove handles and selection from clone
    const handles = clone.querySelectorAll(".o-resize-handle, .dashed-box");
    handles.forEach((h) => h.remove());
    // Also remove pointer events capture listeners etc? Not needed for clone.
    // We need to inline styles if they are computed?
    // For SVG export, we can construct an SVG containing everything.
    // Simplest: Create canvas, draw SVG.

    // Since we have HTML elements (divs for shapes), we need to serialize HTML to Image.
    // We can use a simple approach: SVG <foreignObject>.

    const width = root.clientWidth;
    const height = root.clientHeight;

    const data = new XMLSerializer().serializeToString(root);
    // We need to wrap it in foreignObject and SVG
    const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
                <foreignObject width="100%" height="100%">
                    <div xmlns="http://www.w3.org/1999/xhtml" style="width:100%; height:100%; position:relative; background-color: ${
                      this.drawingData?.backgroundColor || "transparent"
                    }">
                        ${data}
                    </div>
                </foreignObject>
            </svg>
        `;

    const img = new Image();
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const pngUrl = canvas.toDataURL("image/png");

        const link = document.createElement("a");
        link.download = `drawing-${this.props.figureUI.id}.png`;
        link.href = pngUrl;
        link.click();
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  isElementSelected(elementId: string): boolean {
    const isFigureSelected =
      this.env.model.getters.getSelectedFigureId() === this.props.figureUI.id;
    return isFigureSelected && this.drawingData?.selectedElementId === elementId;
  }
}
