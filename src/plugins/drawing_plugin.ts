import { UIPlugin } from "@odoo/o-spreadsheet-engine/plugins/ui_plugin";
import { Command, CommandResult } from "../types";

export interface ShapeStyle {
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

export interface DrawingElement {
  id: string;
  type: "rect" | "circle" | "line" | "arrow" | "text";
  x: number;
  y: number;
  width: number;
  height: number;
  style: ShapeStyle;
  text?: string;
}

export interface DrawingData {
  elements: DrawingElement[];
  gridSize: number;
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
      case "CREATE_DRAWING_FIGURE" as any:
        this.createDrawing((cmd as any).figureId);
        break;
      case "ADD_DRAWING_ELEMENT" as any:
        this.addElement((cmd as any).figureId, (cmd as any).element);
        break;
      case "UPDATE_DRAWING_ELEMENT" as any:
        this.updateElement((cmd as any).figureId, (cmd as any).elementId, (cmd as any).updates);
        break;
      case "REMOVE_DRAWING_ELEMENT" as any:
        this.removeElement((cmd as any).figureId, (cmd as any).elementId);
        break;
      case "DELETE_FIGURE" as any:
        this.deleteDrawing((cmd as any).figureId);
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
      // Enforce grid alignment on creation? Or trust the command?
      // Let's rely on the trusted command to provide aligned coordinates if needed,
      // but we could enforce it here too. For now, trust the input.
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
}
