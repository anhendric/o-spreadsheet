import { Command, CommandResult, UpdateLatexFigureCommand } from "../../types/commands";
import { UID } from "../../types/misc";
import { CorePlugin } from "../core_plugin";

export class LatexPlugin extends CorePlugin {
  static getters = ["getLatexContent"] as const;
  private latexContent: Record<string, string> = {};

  allowDispatch(cmd: Command) {
    return CommandResult.Success;
  }

  handle(cmd: Command) {
    switch (cmd.type) {
      case "UPDATE_LATEX_FIGURE":
        const { figureId, latex } = cmd as UpdateLatexFigureCommand;
        this.latexContent[figureId] = latex;
        // Also trigger a figure update to refresh UI?
        // the getter will return new content, component should react.
        // We might need to touch the figure to trigger reactivity if the component relies on figure object reference.
        // But if component uses useStore/getter, it should be fine?
        // Actually, CorePlugin getters are not reactive in the same way as UI stores.
        // UI stores subscribe to model events.
        // CorePlugin state changes trigger "plugin-state-updated" or similar?
        // Usually we emit a change.
        // But let's rely on standard flow.
        break;

      case "DELETE_FIGURE":
        // Cleanup
        const delCmd = cmd as any;
        if (this.latexContent[delCmd.figureId]) {
          delete this.latexContent[delCmd.figureId];
        }
        break;
    }
  }

  getLatexContent(figureId: UID): string | undefined {
    return this.latexContent[figureId];
  }

  // Percistence
  exportForModel() {
    return { latexContent: this.latexContent };
  }

  import(data: any) {
    if (data.latexContent) {
      this.latexContent = data.latexContent;
    }
  }
  export(data: any) {
    data.latexContent = this.latexContent;
  }
}
