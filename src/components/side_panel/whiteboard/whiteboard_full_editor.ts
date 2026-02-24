import { UID } from "@odoo/o-spreadsheet-engine/types/misc";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component, onMounted, onWillUnmount, useRef } from "@odoo/owl";
import * as ACTION_INSERT from "../../../actions/insert_actions";
import { Store, useStore } from "../../../store_engine";
import { FiguresContainer } from "../../figures/figure_container/figure_container";
import { WhiteboardTabStore } from "./whiteboard_tab_store";

interface Props {
  whiteboardId: UID;
}

export class WhiteboardFullEditor extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-WhiteboardFullEditor";
  static components = { FiguresContainer };
  static props = {
    whiteboardId: String,
  };

  whiteboardTabStore!: Store<WhiteboardTabStore>;
  private previousSheetId: UID | null = null;
  private canvasRef = useRef("canvas");
  private _resizeObserver?: ResizeObserver;

  setup() {
    this.whiteboardTabStore = useStore(WhiteboardTabStore);

    const activeSheetId = this.env.model.getters.getActiveSheetId();
    if (activeSheetId !== this.props.whiteboardId) {
      this.previousSheetId = activeSheetId;
    }

    onMounted(() => {
      if (this.env.model.getters.getActiveSheetId() !== this.props.whiteboardId) {
        this.env.model.dispatch("ACTIVATE_SHEET", {
          sheetIdFrom: this.env.model.getters.getActiveSheetId(),
          sheetIdTo: this.props.whiteboardId,
        });
      }

      this._resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (entry) {
          const { width, height } = entry.contentRect;
          this.env.model.dispatch("RESIZE_SHEETVIEW", { width, height });
        }
      });
      this._resizeObserver.observe(this.canvasRef.el!);
    });

    onWillUnmount(() => {
      this._resizeObserver?.disconnect();
      const currentActiveSheetId = this.env.model.getters.getActiveSheetId();
      if (
        currentActiveSheetId === this.props.whiteboardId &&
        this.previousSheetId &&
        this.env.model.getters.getSheet(this.previousSheetId)
      ) {
        this.env.model.dispatch("ACTIVATE_SHEET", {
          sheetIdFrom: currentActiveSheetId,
          sheetIdTo: this.previousSheetId,
        });
      }
    });
  }

  get whiteboardName() {
    return this.env.model.getters.getSheetName(this.props.whiteboardId);
  }

  insertChart() {
    ACTION_INSERT.insertChart.execute?.(this.env);
  }

  insertImage() {
    ACTION_INSERT.insertImage.execute?.(this.env);
  }

  async insertDrawing() {
    const figureId = this.env.model.uuidGenerator.uuidv4();
    await this.env.model.dispatch("CREATE_FIGURE", {
      sheetId: this.props.whiteboardId,
      figureId,
      tag: "drawing",
      col: 0,
      row: 0,
      offset: { x: 100, y: 100 },
      size: { width: 400, height: 300 },
    });
    await this.env.model.dispatch("CREATE_DRAWING_FIGURE", { figureId });
    this.env.model.dispatch("SELECT_FIGURE", { figureId });
    this.env.openSidePanel("DrawingSidePanel", { figureId });
  }

  async insertEquation() {
    const sheetId = this.props.whiteboardId;
    const figureId = this.env.model.uuidGenerator.smallUuid();
    await this.env.model.dispatch("CREATE_FIGURE", {
      sheetId,
      figureId,
      tag: "latex",
      col: 0,
      row: 0,
      offset: { x: 100, y: 100 },
      size: { width: 200, height: 100 },
    });
    await this.env.model.dispatch("UPDATE_LATEX_FIGURE", {
      figureId,
      latex: String.raw`\int_{-\infty}^\infty e^{-x^2} dx = \sqrt{\pi}`,
    });
    this.env.model.dispatch("SELECT_FIGURE", { figureId });
  }

  onCanvasMouseDown() {
    this.env.model.dispatch("SELECT_FIGURE", { figureId: null });
  }

  close() {
    const visibleSheetIds = this.env.model.getters.getVisibleSheetIds();
    const firstRegularSheet = visibleSheetIds.find(
      (id) => !this.env.model.getters.getSheet(id).isWhiteboard
    );
    if (firstRegularSheet) {
      this.env.model.dispatch("ACTIVATE_SHEET", {
        sheetIdFrom: this.props.whiteboardId,
        sheetIdTo: firstRegularSheet,
      });
    } else {
      this.whiteboardTabStore.closeTab(this.props.whiteboardId);
    }
  }
}
