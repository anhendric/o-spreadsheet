import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import {
  Component,
  onMounted,
  onWillUnmount,
  onWillUpdateProps,
  useRef,
  useState,
} from "@odoo/owl";
import { getLatexImage } from "../../../helpers/latex";
import { CSSProperties, FigureUI, Rect, UID } from "../../../types";

interface Props {
  figureUI: FigureUI;
  editFigureStyle?: (properties: CSSProperties) => void;
  openContextMenu?: (anchorRect: Rect, onClose?: () => void) => void;
}

export class LatexFigure extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-LatexFigure";
  static props = {
    figureUI: Object,
    editFigureStyle: { type: Function, optional: true },
    openContextMenu: { type: Function, optional: true },
  };

  state = useState({ imgUrl: "", isEditing: false });
  textareaRef = useRef("textarea");

  setup() {
    this.updateImage();
    onWillUpdateProps(() => this.updateImage());
    onMounted(() => this.env.model.on("update", this, this.onModelUpdate));
    onWillUnmount(() => this.env.model.off("update", this));
  }

  onModelUpdate = () => {
    this.updateImage();
  };

  async onDoubleClick(ev: MouseEvent) {
    this.state.isEditing = true;
    // Wait for render
    await Promise.resolve();
    const textarea = this.textareaRef.el as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
      textarea.select();
    }
  }

  onInput(ev: InputEvent) {
    ev.stopPropagation();
  }

  onKeydown(ev: KeyboardEvent) {
    if (ev.key === "Enter") {
      this.saveAndClose();
      ev.stopPropagation();
      ev.preventDefault();
    } else if (ev.key === "Escape") {
      this.state.isEditing = false;
      ev.stopPropagation();
      ev.preventDefault();
    } else if (ev.key === "Delete" || ev.key === "Backspace") {
      ev.stopPropagation();
    }
  }

  onBlur() {
    this.saveAndClose();
  }

  saveAndClose() {
    const textarea = this.textareaRef.el as HTMLInputElement;
    if (textarea) {
      const newLatex = textarea.value;
      // Only update if changed, or just update.
      this.updateLatex(newLatex);
    }
    this.state.isEditing = false;
  }

  updateLatex(latex: string) {
    this.env.model.dispatch("UPDATE_LATEX_FIGURE", { figureId: this.figureId, latex });
  }

  get figureId(): UID {
    return this.props.figureUI.id;
  }

  get latex(): string {
    return this.env.model.getters.getLatexContent(this.figureId) || "";
  }

  async updateImage() {
    const latex = this.latex;
    if (!latex) {
      this.state.imgUrl = "";
      return;
    }
    // Color? We can use figure style color if available, or black.
    const color = "#000000";
    const fontSize = 20; // Default size? Should be configurable?
    const img = await getLatexImage(latex, fontSize, color);
    if (img && this.state.imgUrl !== img.src) {
      this.state.imgUrl = img.src;
    }
  }
}
