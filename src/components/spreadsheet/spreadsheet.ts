import { cssPropertiesToCss } from "@odoo/o-spreadsheet-engine/components/helpers/css";
import { MAXIMAL_FREEZABLE_RATIO } from "@odoo/o-spreadsheet-engine/constants";
import { unregisterChartJsExtensions } from "@odoo/o-spreadsheet-engine/helpers/figures/charts/chart_js_extension";
import { Model } from "@odoo/o-spreadsheet-engine/model";
import { _t } from "@odoo/o-spreadsheet-engine/translation";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { NotificationStoreMethods } from "@odoo/o-spreadsheet-engine/types/stores/notification_store_methods";
import {
  Component,
  onMounted,
  onPatched,
  onWillUnmount,
  onWillUpdateProps,
  useExternalListener,
  useRef,
  useSubEnv,
} from "@odoo/owl";
import { batched } from "../../helpers";
import { ImageProvider } from "../../helpers/figures/images/image_provider";
import { Store, useStore, useStoreProvider } from "../../store_engine";
import { ModelStore } from "../../stores";
import { NotificationStore } from "../../stores/notification_store";
import { ScreenWidthStore } from "../../stores/screen_width_store";
import { CommandResult, CSSProperties, InformationNotification, Pixel } from "../../types";
import { BottomBar } from "../bottom_bar/bottom_bar";
import { ComposerFocusStore } from "../composer/composer_focus_store";
import { FullScreenFigure } from "../full_screen_figure/full_screen_figure";
import { Grid } from "../grid/grid";
import { HeaderGroupContainer } from "../header_group/header_group_container";
import { isMobileOS, zoomCorrectedElementRect } from "../helpers/dom_helpers";
import { useSpreadsheetRect } from "../helpers/position_hook";
import { useScreenWidth } from "../helpers/screen_width_hook";
import { CustomFunctionTabStore } from "../side_panel/custom_functions/custom_function_tab_store";
import { DEFAULT_SIDE_PANEL_SIZE, SidePanelStore } from "../side_panel/side_panel/side_panel_store";
import { SidePanels } from "../side_panel/side_panels/side_panels";
import { WhiteboardTabStore } from "../side_panel/whiteboard/whiteboard_tab_store";
import { SmallBottomBar } from "../small_bottom_bar/small_bottom_bar";
import { TopBar } from "../top_bar/top_bar";
import { instantiateClipboard } from "./../../helpers/clipboard/navigator_clipboard_wrapper";
import { SplitViewStore } from "./split_view_store";
import { SpreadsheetPane } from "./spreadsheet_pane";

// -----------------------------------------------------------------------------
// SpreadSheet
// -----------------------------------------------------------------------------

// FIXME Used in encoding in css
// const CARET_DOWN_SVG = /*xml*/ `
// <svg xmlns='http://www.w3.org/2000/svg' width='7' height='4' viewBox='0 0 7 4'>
//   <polygon fill='%23374151' points='3.5 4 7 0 0 0'/>
// </svg>
// `;

export interface SpreadsheetProps extends Partial<NotificationStoreMethods> {
  model: Model;
  colorScheme?: "dark" | "light";
}

export class Spreadsheet extends Component<SpreadsheetProps, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-Spreadsheet";
  static props = {
    model: Object,
    notifyUser: { type: Function, optional: true },
    raiseError: { type: Function, optional: true },
    askConfirmation: { type: Function, optional: true },
    colorScheme: { type: String, optional: true },
  };
  static components = {
    TopBar,
    Grid,
    BottomBar,
    SmallBottomBar,
    SidePanels,
    HeaderGroupContainer,
    FullScreenFigure,
    SpreadsheetPane,
  };

  spreadsheetRef = useRef("spreadsheet");
  spreadsheetRect = useSpreadsheetRect();

  private isViewportTooSmall: boolean = false;
  private notificationStore!: Store<NotificationStore>;
  private composerFocusStore!: Store<ComposerFocusStore>;
  sidePanel!: Store<SidePanelStore>;
  customFunctionTabStore!: Store<CustomFunctionTabStore>;
  whiteboardTabStore!: Store<WhiteboardTabStore>;
  splitViewStore!: Store<SplitViewStore>;

  private paneFocusGrids: { left?: () => void; right?: () => void } = {};
  private renderComponent!: (force?: any) => void;

  get model(): Model {
    return this.props.model;
  }

  get getters() {
    return this.props.model.getters;
  }

  getStyle(): string {
    const properties: CSSProperties = {};
    const scrollbarWidth = this.env.model.getters.getScrollBarWidth();
    properties["grid-template-rows"] = `min-content auto min-content`;
    const columnWidth = this.sidePanel.mainPanel
      ? `${this.sidePanel.totalPanelSize || DEFAULT_SIDE_PANEL_SIZE}px`
      : "auto";
    properties["grid-template-columns"] = `auto ${columnWidth}`;
    properties["--os-scrollbar-width"] = `${scrollbarWidth}px`;
    properties["color-scheme"] = this.props.colorScheme;

    return cssPropertiesToCss(properties);
  }

  setup() {
    if (!("isSmall" in this.env)) {
      const screenSize = useScreenWidth();
      useSubEnv({
        get isSmall() {
          return screenSize.isSmall;
        },
      } satisfies Partial<SpreadsheetChildEnv>);
    }

    const stores = useStoreProvider();
    stores.inject(ModelStore, this.model);

    const env = this.env;
    stores.get(ScreenWidthStore).setSmallThreshhold(() => {
      return env.isSmall;
    });

    this.notificationStore = useStore(NotificationStore);
    this.composerFocusStore = useStore(ComposerFocusStore);
    this.sidePanel = useStore(SidePanelStore);
    this.customFunctionTabStore = useStore(CustomFunctionTabStore);
    this.whiteboardTabStore = useStore(WhiteboardTabStore);
    this.splitViewStore = useStore(SplitViewStore);

    this.renderComponent = batched(() => {
      this.render(true);
    });

    this.focusLeftPane = this.focusLeftPane.bind(this);
    this.focusRightPane = this.focusRightPane.bind(this);
    this.focusGrid = this.focusGrid.bind(this);

    const fileStore = this.model.config.external.fileStore;

    useSubEnv({
      model: this.model,
      imageProvider: fileStore ? new ImageProvider(fileStore) : undefined,
      loadCurrencies: this.model.config.external.loadCurrencies,
      loadLocales: this.model.config.external.loadLocales,
      openSidePanel: this.sidePanel.open.bind(this.sidePanel),
      replaceSidePanel: this.sidePanel.replace.bind(this.sidePanel),
      toggleSidePanel: this.sidePanel.toggle.bind(this.sidePanel),
      clipboard: this.env.clipboard || instantiateClipboard(),
      startCellEdition: (content?: string) =>
        this.composerFocusStore.focusActiveComposer({ content }),
      notifyUser: (notification) => this.notificationStore.notifyUser(notification),
      askConfirmation: (text, confirm, cancel) =>
        this.notificationStore.askConfirmation(text, confirm, cancel),
      raiseError: (text, cb) => this.notificationStore.raiseError(text, cb),
      isMobile: isMobileOS,
    } satisfies Partial<SpreadsheetChildEnv>);

    this.notificationStore.updateNotificationCallbacks({ ...this.props });

    // useEffect(() => {
    //   /**
    //    * Only refocus the grid if the active element is not a child of the spreadsheet
    //    * (i.e. activeElement is outside of the spreadsheetRef component)
    //    * and spreadsheet is a child of that element. Anything else means that the focus
    //    * is on an element that needs to keep it.
    //    */
    //   if (
    //     !this.spreadsheetRef.el!.contains(document.activeElement) &&
    //     document.activeElement?.contains(this.spreadsheetRef.el!)
    //   ) {
    //     this.focusGrid();
    //   }
    // });

    useExternalListener(window, "resize", () => this.render(true));
    // For some reason, the wheel event is not properly registered inside templates
    // in Chromium-based browsers based on chromium 125
    // This hack ensures the event declared in the template is properly registered/working
    useExternalListener(document.body, "wheel", () => {});

    onWillUpdateProps((nextProps: SpreadsheetProps) => {
      if (nextProps.model !== this.props.model) {
        throw new Error("Changing the props model is not supported at the moment.");
      }
      if (
        nextProps.notifyUser !== this.props.notifyUser ||
        nextProps.askConfirmation !== this.props.askConfirmation ||
        nextProps.raiseError !== this.props.raiseError
      ) {
        this.notificationStore.updateNotificationCallbacks({ ...nextProps });
      }
    });

    onMounted(() => {
      this.bindModelEvents();
      this.checkViewportSize();
      stores.on("store-updated", this, this.renderComponent);
      resizeObserver.observe(this.spreadsheetRef.el!);
    });
    onWillUnmount(() => {
      this.unbindModelEvents();
      stores.off("store-updated", this);
      resizeObserver.disconnect();
      unregisterChartJsExtensions();
    });
    onPatched(() => {
      this.checkViewportSize();
    });
    const resizeObserver = new ResizeObserver(() => {
      this.sidePanel.changeSpreadsheetWidth(this.spreadsheetRect.width);
    });
  }

  focusLeftPane() {
    if (this.splitViewStore.focusedPane !== "left" && this.splitViewStore.isSplitView) {
      // The right pane is currently focused (reading the global viewport). Save its position
      // to the per-pane viewport so it's preserved when it becomes inactive, then restore
      // the left pane's saved per-pane scroll into the global viewport.
      const rightSheetId = this.rightSheetId;
      const { scrollX, scrollY } = this.getters.getActiveSheetScrollInfo(rightSheetId);
      this.model.dispatch("SET_VIEWPORT_OFFSET", {
        sheetId: rightSheetId,
        paneId: "right",
        offsetX: scrollX,
        offsetY: scrollY,
      });

      this.splitViewStore.setFocusedPane("left");
      const targetSheetId = this.splitViewStore.leftSheetId;
      if (targetSheetId && this.getters.getActiveSheetId() !== targetSheetId) {
        this.env.model.dispatch("ACTIVATE_SHEET", {
          sheetIdFrom: this.getters.getActiveSheetId(),
          sheetIdTo: targetSheetId,
        });
      }

      // The left pane is now focused and will read the global viewport. Restore its
      // per-pane scroll position into the global viewport so there is no jump.
      const leftSheetId = this.leftSheetId;
      const { scrollX: leftScrollX, scrollY: leftScrollY } = this.getters.getActiveSheetScrollInfo(
        leftSheetId,
        "left"
      );
      this.model.dispatch("SET_VIEWPORT_OFFSET", {
        sheetId: leftSheetId,
        offsetX: leftScrollX,
        offsetY: leftScrollY,
      });
    } else {
      this.splitViewStore.setFocusedPane("left");
    }
  }

  focusRightPane() {
    if (this.splitViewStore.focusedPane !== "right" && this.splitViewStore.isSplitView) {
      // The left pane is currently focused (reading the global viewport). Save its position
      // to the per-pane viewport so it's preserved when it becomes inactive, then restore
      // the right pane's saved per-pane scroll into the global viewport.
      const leftSheetId = this.leftSheetId;
      const { scrollX, scrollY } = this.getters.getActiveSheetScrollInfo(leftSheetId);
      this.model.dispatch("SET_VIEWPORT_OFFSET", {
        sheetId: leftSheetId,
        paneId: "left",
        offsetX: scrollX,
        offsetY: scrollY,
      });

      this.splitViewStore.setFocusedPane("right");
      const targetSheetId = this.splitViewStore.rightSheetId;
      if (targetSheetId && this.getters.getActiveSheetId() !== targetSheetId) {
        this.env.model.dispatch("ACTIVATE_SHEET", {
          sheetIdFrom: this.getters.getActiveSheetId(),
          sheetIdTo: targetSheetId,
        });
      }

      // The right pane is now focused and will read the global viewport. Restore its
      // per-pane scroll position into the global viewport so there is no jump.
      const rightSheetId = this.rightSheetId;
      const { scrollX: rightScrollX, scrollY: rightScrollY } =
        this.getters.getActiveSheetScrollInfo(rightSheetId, "right");
      this.model.dispatch("SET_VIEWPORT_OFFSET", {
        sheetId: rightSheetId,
        offsetX: rightScrollX,
        offsetY: rightScrollY,
      });
    } else {
      this.splitViewStore.setFocusedPane("right");
    }
  }

  get leftSheetId() {
    return this.splitViewStore.leftSheetId || this.getters.getActiveSheetId();
  }

  get rightSheetId() {
    return this.splitViewStore.rightSheetId || this.getters.getActiveSheetId();
  }

  private bindModelEvents() {
    this.model.on("update", this, this.renderComponent);
    this.model.on("command-rejected", this, ({ result }) => {
      if (result.isCancelledBecause(CommandResult.SheetLocked)) {
        this.notificationStore.notifyUser({
          type: "info",
          text: _t("This sheet is locked and cannot be modified. Please unlock it first."),
          sticky: false,
        });
      }
    });

    this.model.on("notify-ui", this, (notification: InformationNotification) =>
      this.notificationStore.notifyUser(notification)
    );
    this.model.on("raise-error-ui", this, ({ text }) => this.notificationStore.raiseError(text));
  }

  private unbindModelEvents() {
    this.model.off("update", this);
    this.model.off("command-rejected", this);
    this.model.off("notify-ui", this);
    this.model.off("raise-error-ui", this);
  }

  private checkViewportSize() {
    const { xRatio, yRatio } = this.env.model.getters.getFrozenSheetViewRatio(
      this.env.model.getters.getActiveSheetId()
    );

    if (!isFinite(xRatio) || !isFinite(yRatio)) {
      // before mounting, the ratios can be NaN or Infinity if the viewport size is 0
      return;
    }

    if (yRatio > MAXIMAL_FREEZABLE_RATIO || xRatio > MAXIMAL_FREEZABLE_RATIO) {
      if (this.isViewportTooSmall) {
        return;
      }
      this.notificationStore.notifyUser({
        text: _t(
          "The current window is too small to display this sheet properly. Consider resizing your browser window or adjusting frozen rows and columns."
        ),
        type: "warning",
        sticky: false,
      });
      this.isViewportTooSmall = true;
    } else {
      this.isViewportTooSmall = false;
    }
  }

  focusGrid() {
    const pane = this.splitViewStore.focusedPane;
    const focus = pane ? this.paneFocusGrids[pane] : undefined;
    if (focus) {
      focus();
    }
  }

  get gridHeight(): Pixel {
    return this.env.model.getters.getSheetViewDimension().height;
  }

  get gridContainerStyle(): string {
    const zoom = this.env.model.getters.getViewportZoomLevel();
    return cssPropertiesToCss({
      zoom: `${zoom}`,
    });
  }

  getGridSize() {
    const el = this.spreadsheetRef.el;
    if (!el) {
      return { width: 0, height: 0 };
    }

    const zoom = this.env.model.getters.getViewportZoomLevel();
    const scrollbarWidth = this.env.model.getters.getScrollBarWidth();

    const getHeight = (s: string) =>
      (el.querySelector(s) && zoomCorrectedElementRect(el.querySelector(s)!, zoom).height) || 0;
    const getWidth = (s: string) =>
      (el.querySelector(s) && zoomCorrectedElementRect(el.querySelector(s)!, zoom).width) || 0;

    const rect = el.getBoundingClientRect();
    const topBarHeight = getHeight(".o-spreadsheet-topbar-wrapper");
    const colGroupHeight = getHeight(".o-column-groups");
    const gridWidth = getWidth(".o-grid");
    const gridHeight = rect.height - colGroupHeight - topBarHeight;

    return {
      width: Math.max(gridWidth / zoom - scrollbarWidth, 0),
      height: Math.max(gridHeight / zoom - scrollbarWidth, 0),
    };
  }

  getSpreadSheetClasses() {
    return [
      this.env.isSmall ? "o-spreadsheet-mobile" : "",
      this.props.colorScheme === "dark" ? "dark" : "",
    ].join(" ");
  }
}
