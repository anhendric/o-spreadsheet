import { functionRegistry } from "@odoo/o-spreadsheet-engine/functions/function_registry";
import { toCartesian } from "@odoo/o-spreadsheet-engine/helpers/coordinates";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component, onMounted, useRef, useState } from "@odoo/owl";

interface ConsoleEntry {
  code: string;
  result?: string;
  error?: string;
}

interface ConsoleState {
  history: ConsoleEntry[];
  currentInput: string;
  historyIndex: number;
}

export class ConsolePanel extends Component<any, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-ConsolePanel";
  static props = {
    onCloseSidePanel: { type: Function, optional: true },
  };

  private state = useState<ConsoleState>({
    history: [],
    currentInput: "",
    historyIndex: -1,
  });

  private inputRef = useRef("input");
  private historyRef = useRef("history");
  private context: Record<string, any> = {};

  setup() {
    onMounted(() => {
      this.focusInput();
    });
  }

  focusInput() {
    const input = this.inputRef.el as HTMLInputElement;
    if (input) {
      input.focus();
    }
  }

  onKeyDown(ev: KeyboardEvent) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      this.execute();
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      this.navigateHistory(-1);
    } else if (ev.key === "ArrowDown") {
      ev.preventDefault();
      this.navigateHistory(1);
    }
  }

  navigateHistory(direction: number) {
    const history = this.state.history;
    if (history.length === 0) {
      return;
    }

    let newIndex = this.state.historyIndex + direction;

    // Clamp index
    if (newIndex < -1) {
      newIndex = -1;
    }
    if (newIndex >= history.length) {
      newIndex = history.length - 1;
    }

    this.state.historyIndex = newIndex;

    if (newIndex === -1) {
      this.state.currentInput = "";
    } else {
      this.state.currentInput = history[history.length - 1 - newIndex].code;
    }
  }

  execute() {
    const code = this.state.currentInput.trim();
    if (!code) {
      return;
    }

    const entry: ConsoleEntry = { code };

    try {
      const result = this.evalCode(code);
      entry.result = this.formatResult(result);
      // Update context if result is not undefined and not a function
      // This is a simplification; real REPLs are more complex
      this.context["_"] = result;
    } catch (e: any) {
      entry.error = e.message || String(e);
    }

    this.state.history.push(entry);
    this.state.currentInput = "";
    this.state.historyIndex = -1;

    // Scroll to bottom
    requestAnimationFrame(() => {
      if (this.historyRef.el) {
        this.historyRef.el.scrollTop = this.historyRef.el.scrollHeight;
      }
    });
  }

  private evalCode(code: string) {
    const getters = this.env.model.getters;
    const context = this.context;

    // Proxy to intercept variable access
    const proxy = new Proxy(context, {
      get: (target, prop: string | symbol) => {
        if (prop === Symbol.unscopables) {
          return undefined;
        }
        if (typeof prop !== "string") {
          return undefined;
        }
        if (prop in target) {
          return target[prop];
        }
        if (prop in window) {
          return (window as any)[prop];
        }

        // Check for Cell Coordinates (e.g. A1, B2)
        if (/^([A-Z]+)([0-9]+)$/.test(prop)) {
          try {
            const sheetId = getters.getActiveSheetId();
            const { col, row } = toCartesian(prop);
            return getters.getEvaluatedCell({ sheetId, col, row }).value;
          } catch (e) {
            // Ignore invalid coordinates
          }
        }

        // Add evaluate helper
        if (prop === "evaluate") {
          return (formula: string) => {
            const sheetId = getters.getActiveSheetId();
            // @ts-ignore
            return getters.evaluateFormula(sheetId, formula);
          };
        }

        // Check for Spreadhsheet Functions (e.g. SUM, MAX)
        if (functionRegistry.contains(prop)) {
          // fnDef is not needed if we are just relaying the call via evaluateFormula
          return (...args: any[]) => {
            const argsStr = args.map((arg) => this.serializeForFormula(arg)).join(",");
            const formula = `=${prop}(${argsStr})`;
            const sheetId = getters.getActiveSheetId();
            // @ts-ignore
            return getters.evaluateFormula(sheetId, formula);
          };
        }

        return undefined;
      },
      set: (target, prop: string | symbol, value: any) => {
        if (typeof prop === "string") {
          target[prop] = value;
          return true;
        }
        return false;
      },
      has: (target, prop: string | symbol) => {
        // Always return true for strings to ensure variables are resolved against the proxy (and thus captured in context)
        // except for symbols or unscopables
        return typeof prop === "string";
      },
    });

    // We use `with` to inject our proxy scope

    const fn = new Function(
      "context",
      `
      with (context) {
        return (function() { 
          return eval("${code.replace(/"/g, '\\"')}");
        })();
      }
    `
    );

    return fn(proxy);
  }

  private serializeForFormula(arg: any): string {
    if (typeof arg === "string") {
      return `"${arg}"`;
    }
    if (typeof arg === "number") {
      return String(arg);
    }
    if (typeof arg === "boolean") {
      return String(arg).toUpperCase();
    }
    if (arg === undefined || arg === null) {
      return "";
    }
    return String(arg);
  }

  private formatResult(result: any): string {
    if (result === undefined) {
      return "undefined";
    }
    if (result === null) {
      return "null";
    }
    if (typeof result === "object") {
      return JSON.stringify(result, null, 2);
    }
    return String(result);
  }
}
