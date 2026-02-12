import { DrawingElement } from "@odoo/o-spreadsheet-engine/plugins/core/drawing";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component, useEffect, useRef, useState } from "@odoo/owl";
import { BorderStyle, borderStyles, ChartStyle, Rect, UID } from "../../../types";
import { ColorPickerWidget } from "../../color_picker/color_picker_widget";
import { Popover, PopoverProps } from "../../popover/popover";
import { TextStyler } from "../chart/building_blocks/text_styler/text_styler";
import { RoundColorPicker } from "../components/round_color_picker/round_color_picker";
import { Section } from "../components/section/section";
import { MarkerSelector } from "./marker_selector/marker_selector";

interface Props {
  figureId: UID;
  onCloseSidePanel: () => void;
}

export class DrawingSidePanel extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-DrawingSidePanel";
  static components = {
    ColorPickerWidget,
    RoundColorPicker,
    TextStyler,
    Popover,
    MarkerSelector,
    Section,
  };
  static props = {
    figureId: String,
    onCloseSidePanel: Function,
  };

  setup() {
    useEffect(
      () => {
        const figureId = this.props.figureId;
        return () => {
          this.env.model.dispatch("SELECT_DRAWING_ELEMENT", {
            figureId,
            elementId: null,
          });
        };
      },
      () => [this.props.figureId]
    );
  }

  state = useState({
    activeTool: "",
  });

  lineStyleButtonRef = useRef("lineStyleButton");
  svgTextarea = useRef("svgTextarea");
  borderStyles = borderStyles;

  get drawing() {
    return this.env.model.getters.getDrawing(this.props.figureId);
  }

  get selectedElement(): DrawingElement | undefined {
    const id = this.drawing?.selectedElementId;
    if (id && this.drawing) {
      return this.drawing.elements.find((e) => e.id === id);
    }
    return undefined;
  }

  // Helper to snap to grid
  snapToGrid(val: number): number {
    const gridSize = this.drawing?.gridSize || 20;
    return Math.round(val / gridSize) * gridSize;
  }

  addShape(type: "rect" | "circle" | "arrow" | "line" | "text" | "svg") {
    const id = this.env.model.uuidGenerator.uuidv4();
    const gridSize = this.drawing?.gridSize || 20;

    const element: DrawingElement = {
      id,
      type,
      x: gridSize,
      y: gridSize,
      width: type === "arrow" || type === "line" ? gridSize * 4 : gridSize * 4,
      height:
        type === "arrow" || type === "line"
          ? gridSize * 2
          : type === "circle"
          ? gridSize * 4
          : gridSize * 2,
      style: {
        fillColor: type === "arrow" || type === "line" || type === "text" ? undefined : "#e0e0e0",
        strokeColor: "black",
        strokeWidth: 2,
        endArrow: type === "arrow" ? "arrow" : undefined,
        fontSize: type === "text" ? 16 : undefined,
        textColor: type === "text" ? "#000000" : undefined,
        align: type === "text" ? "center" : undefined,
      },
      points:
        type === "arrow" || type === "line"
          ? [
              { x: gridSize, y: gridSize },
              { x: gridSize + gridSize * 4, y: gridSize + gridSize * 2 },
            ]
          : undefined,
      text: type === "text" ? "Double click to edit" : undefined,
      svgContent:
        type === "svg"
          ? '<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="red"/></svg>'
          : undefined,
    };

    this.env.model.dispatch("ADD_DRAWING_ELEMENT", {
      figureId: this.props.figureId,
      element,
    });

    this.env.model.dispatch("SELECT_DRAWING_ELEMENT", {
      figureId: this.props.figureId,
      elementId: id,
    });
  }

  onChangeAttr(attr: keyof DrawingElement, value: string) {
    if (!this.selectedElement) return;

    if (attr === "text" || attr === "svgContent") {
      this.env.model.dispatch("UPDATE_DRAWING_ELEMENT", {
        figureId: this.props.figureId,
        elementId: this.selectedElement.id,
        updates: { [attr]: value },
      });
      return;
    }

    let numVal = parseInt(value);
    if (isNaN(numVal)) return;

    // Snap to grid
    numVal = this.snapToGrid(numVal);

    this.env.model.dispatch("UPDATE_DRAWING_ELEMENT", {
      figureId: this.props.figureId,
      elementId: this.selectedElement.id,
      updates: { [attr]: numVal },
    });
  }

  onSaveSvg() {
    if (!this.selectedElement || !this.svgTextarea.el) return;
    const rawContent = (this.svgTextarea.el as HTMLTextAreaElement).value;

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(rawContent, "image/svg+xml");
      const svg = doc.querySelector("svg");

      let newContent = rawContent;
      if (svg) {
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        // We use XMLSerializer to be safe with SVG namespaces
        const serializer = new XMLSerializer();
        newContent = serializer.serializeToString(svg);
      }

      this.env.model.dispatch("UPDATE_DRAWING_ELEMENT", {
        figureId: this.props.figureId,
        elementId: this.selectedElement.id,
        updates: { svgContent: newContent },
      });
    } catch (e) {
      console.error("Invalid SVG content", e);
      // Dispatch raw content anyway if parse fails? Or notify user?
      // Let's dispatch raw content if parse fails, user might see visual error.
      this.env.model.dispatch("UPDATE_DRAWING_ELEMENT", {
        figureId: this.props.figureId,
        elementId: this.selectedElement.id,
        updates: { svgContent: rawContent },
      });
    }
  }

  onChangeStyle(attr: keyof DrawingElement["style"], value: string) {
    if (!this.selectedElement) return;
    let val: string | number | undefined = value;

    if (attr === "strokeWidth") {
      val = parseInt(value);
      if (isNaN(val)) return;
    }

    const updates = { style: { ...this.selectedElement.style, [attr]: val } };

    this.env.model.dispatch("UPDATE_DRAWING_ELEMENT", {
      figureId: this.props.figureId,
      elementId: this.selectedElement.id,
      updates,
    });
  }

  get textStyle(): ChartStyle {
    if (!this.selectedElement) return {};
    const s = this.selectedElement.style;
    return {
      bold: s.bold,
      italic: s.italic,
      fontSize: s.fontSize,
      align: s.align,
      color: s.textColor || "#000000",
      underline: s.underline,
    };
  }

  updateTextStyle(style: ChartStyle) {
    if (!this.selectedElement) return;
    const updates = {
      style: {
        ...this.selectedElement.style,
        bold: style.bold,
        italic: style.italic,
        fontSize: style.fontSize,
        align: style.align as any,
        textColor: style.color,
        underline: style.underline,
      },
    };
    this.env.model.dispatch("UPDATE_DRAWING_ELEMENT", {
      figureId: this.props.figureId,
      elementId: this.selectedElement.id,
      updates,
    });
  }

  onChangeBackground(value: string) {
    this.env.model.dispatch("UPDATE_DRAWING", {
      figureId: this.props.figureId,
      updates: { backgroundColor: value },
    });
  }

  removeSelected() {
    if (!this.selectedElement) return;
    this.env.model.dispatch("REMOVE_DRAWING_ELEMENT", {
      figureId: this.props.figureId,
      elementId: this.selectedElement.id,
    });
    this.env.model.dispatch("SELECT_DRAWING_ELEMENT", {
      figureId: this.props.figureId,
      elementId: null,
    });
  }

  reorderSelected(direction: "front" | "back" | "forward" | "backward") {
    if (!this.selectedElement) return;
    this.env.model.dispatch("REORDER_DRAWING_ELEMENT", {
      figureId: this.props.figureId,
      elementId: this.selectedElement.id,
      direction,
    });
  }

  onFillColorPicked(color: string) {
    this.onChangeStyle("fillColor", color);
    this.state.activeTool = "";
  }

  onStrokeColorPicked(color: string) {
    this.onChangeStyle("strokeColor", color);
    this.state.activeTool = "";
  }

  toggleDropdownTool(tool: string) {
    if (this.state.activeTool === tool) {
      this.state.activeTool = "";
    } else {
      this.state.activeTool = tool;
    }
  }

  onBorderStylePicked(style: BorderStyle) {
    this.onChangeStyle("borderStyle", style);
    this.state.activeTool = "";
  }

  get lineStylePickerPopoverProps(): PopoverProps {
    return {
      anchorRect: this.lineStylePickerAnchorRect,
      positioning: "bottom-left",
      verticalOffset: 0,
    };
  }

  get lineStylePickerAnchorRect(): Rect {
    const button = this.lineStyleButtonRef.el;
    if (button === null) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const buttonRect = button.getBoundingClientRect();
    return {
      x: buttonRect.x,
      y: buttonRect.y,
      width: buttonRect.width,
      height: buttonRect.height,
    };
  }

  getAnchorRect(ref: any): Rect {
    const button = ref.el;
    if (button === null) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const buttonRect = button.getBoundingClientRect();
    return {
      x: buttonRect.x,
      y: buttonRect.y,
      width: buttonRect.width,
      height: buttonRect.height,
    };
  }
}
