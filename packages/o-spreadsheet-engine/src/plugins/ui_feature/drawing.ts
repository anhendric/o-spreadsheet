import { Command, CommandResult } from "../../types/commands";
import { UIPlugin } from "../ui_plugin";

export interface ShapeStyle {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  startArrow?: string; // "arrow", "circle", "square", "diamond", "none" (or filled variants)
  endArrow?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  textColor?: string;
  borderStyle?: "thin" | "medium" | "thick" | "dashed" | "dotted";
}

export interface DrawingElement {
  id: string;
  type: "rect" | "circle" | "line" | "arrow" | "text" | "svg";
  x: number;
  y: number;
  width: number;
  height: number;
  style: ShapeStyle;
  text?: string;
  svgContent?: string; // For raw SVG
  points?: { x: number; y: number }[]; // For lines and arrows
}

export interface DrawingData {
  elements: DrawingElement[];
  gridSize: number;
  selectedElementId?: string | null;
  backgroundColor?: string;
}

export class DrawingPlugin extends UIPlugin {
  static getters = ["getDrawing"] as const;
  static layers = [];

  private drawings: Record<string, DrawingData> = {};

  allowDispatch(cmd: Command) {
    return CommandResult.Success;
  }

  handle(cmd: Command) {
    switch (cmd.type) {
      case "CREATE_DRAWING_FIGURE":
        this.createDrawing(cmd.figureId);
        break;
      case "ADD_DRAWING_ELEMENT":
        this.addElement(cmd.figureId, cmd.element);
        break;
      case "UPDATE_DRAWING_ELEMENT":
        this.updateElement(cmd.figureId, cmd.elementId, cmd.updates);
        break;
      case "REMOVE_DRAWING_ELEMENT":
        this.removeElement(cmd.figureId, cmd.elementId);
        break;
      case "DELETE_FIGURE":
        this.deleteDrawing(cmd.figureId);
        break;
      case "REORDER_DRAWING_ELEMENT":
        this.reorderElement(cmd.figureId, cmd.elementId, cmd.direction);
        break;
      case "SELECT_DRAWING_ELEMENT":
        this.selectElement(cmd.figureId, cmd.elementId);
        break;
      case "UPDATE_DRAWING":
        this.updateDrawing(cmd.figureId, cmd.updates);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  getDrawing(figureId: string): DrawingData | undefined {
    return this.drawings[figureId];
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private createDrawing(figureId: string) {
    if (!this.drawings[figureId]) {
      this.drawings[figureId] = {
        elements: [],
        gridSize: 20, // Default grid size
      };
    }
  }

  private addElement(figureId: string, element: DrawingElement) {
    const drawing = this.drawings[figureId];
    if (drawing) {
      drawing.elements.push(element);
    }
  }

  private updateElement(figureId: string, elementId: string, updates: Partial<DrawingElement>) {
    const drawing = this.drawings[figureId];
    if (drawing) {
      const index = drawing.elements.findIndex((e) => e.id === elementId);
      if (index !== -1) {
        drawing.elements[index] = { ...drawing.elements[index], ...updates };
      }
    }
  }

  private removeElement(figureId: string, elementId: string) {
    const drawing = this.drawings[figureId];
    if (drawing) {
      drawing.elements = drawing.elements.filter((e) => e.id !== elementId);
    }
  }

  private deleteDrawing(figureId: string) {
    delete this.drawings[figureId];
  }

  private selectElement(figureId: string, elementId: string | null) {
    const drawing = this.drawings[figureId];
    if (drawing) {
      drawing.selectedElementId = elementId;
    }
  }

  private updateDrawing(figureId: string, updates: Partial<DrawingData>) {
    const drawing = this.drawings[figureId];
    if (drawing) {
      Object.assign(drawing, updates);
    }
  }

  private reorderElement(
    figureId: string,
    elementId: string,
    direction: "front" | "back" | "forward" | "backward"
  ) {
    const drawing = this.drawings[figureId];
    if (drawing) {
      const index = drawing.elements.findIndex((e) => e.id === elementId);
      if (index === -1) return;

      const element = drawing.elements[index];
      drawing.elements.splice(index, 1);

      if (direction === "front") {
        drawing.elements.push(element);
      } else if (direction === "back") {
        drawing.elements.unshift(element);
      } else if (direction === "forward") {
        // Move forward means increasing index
        drawing.elements.splice(index + 1, 0, element);
      } else if (direction === "backward") {
        // Move backward means decreasing index
        const newIndex = Math.max(0, index - 1);
        drawing.elements.splice(newIndex, 0, element);
      }
    }
  }
}
