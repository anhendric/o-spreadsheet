import { cssPropertiesToCss } from "@odoo/o-spreadsheet-engine/components/helpers/css";
import { GROUP_LAYER_WIDTH } from "@odoo/o-spreadsheet-engine/constants";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component, onMounted, onWillUnmount, status, useRef, useSubEnv } from "@odoo/owl";
import { batched } from "../../helpers";
import { Store, useStore } from "../../store_engine";
import { ScopedDependencyContainer } from "../../store_engine/scoped_dependency_container";
import { proxifyStoreMutation } from "../../store_engine/store_hooks";
import { GridRenderer } from "../../stores/grid_renderer_store";
import { ModelStore } from "../../stores/model_store";
import { RendererStore } from "../../stores/renderer_store";
import { HeaderGroup, PixelPosition, UID, Zone } from "../../types";
import { BottomBar } from "../bottom_bar/bottom_bar";
import { Grid } from "../grid/grid";
import { HeaderGroupContainer } from "../header_group/header_group_container";
import { CustomFunctionFullEditor } from "../side_panel/custom_functions/custom_function_full_editor";
import { CustomFunctionTabStore } from "../side_panel/custom_functions/custom_function_tab_store";
import { SidePanelStore } from "../side_panel/side_panel/side_panel_store";
import { WhiteboardFullEditor } from "../side_panel/whiteboard/whiteboard_full_editor";
import { WhiteboardTabStore } from "../side_panel/whiteboard/whiteboard_tab_store";
import { SmallBottomBar } from "../small_bottom_bar/small_bottom_bar";
import { SplitViewStore } from "./split_view_store";

interface Props {
  sheetId: UID;
  paneId?: string;
  isFocused: boolean;
  onFocus: () => void;
  exposeFocusGrid: (focus: () => void) => void;
  exposeContainer?: (container: ScopedDependencyContainer) => void;
}

export class SpreadsheetPane extends Component<Props, SpreadsheetChildEnv> {
  static template = "o-spreadsheet-SpreadsheetPane";
  static components = {
    Grid,
    HeaderGroupContainer,
    BottomBar,
    SmallBottomBar,
    WhiteboardFullEditor,
    CustomFunctionFullEditor,
  };
  static props = {
    sheetId: String,
    paneId: { type: String, optional: true },
    isFocused: Boolean,
    onFocus: Function,
    exposeFocusGrid: Function,
    exposeContainer: { type: Function, optional: true },
  };

  sidePanel!: Store<SidePanelStore>;
  splitViewStore!: Store<SplitViewStore>;
  customFunctionTabStore!: Store<CustomFunctionTabStore>;
  whiteboardTabStore!: Store<WhiteboardTabStore>;
  gridContainerRef = useRef("gridContainer");
  private _focusGrid?: () => void;
  private renderComponent!: (force?: any) => void;

  setup() {
    this.sidePanel = useStore(SidePanelStore);
    this.splitViewStore = useStore(SplitViewStore);
    this.customFunctionTabStore = useStore(CustomFunctionTabStore);
    this.whiteboardTabStore = useStore(WhiteboardTabStore);
    this.setupSubEnv();
    onMounted(() => {
      this.props.exposeFocusGrid(() => this.focusGrid());
    });
  }

  private setupSubEnv() {
    const parentModel = this.env.model;

    // Cache bound functions to prevent infinite reactivity loops in Owl
    const boundMethodsCache = new Map<any, Map<string | symbol, Function>>();

    function getBoundMethod(target: any, prop: string | symbol) {
      let targetCache = boundMethodsCache.get(target);
      if (!targetCache) {
        targetCache = new Map();
        boundMethodsCache.set(target, targetCache);
      }
      let bound = targetCache.get(prop);
      if (!bound) {
        const value = (target as any)[prop];
        if (typeof value === "function") {
          bound = value.bind(target);
          targetCache.set(prop, bound!);
        } else {
          return value;
        }
      }
      return bound;
    }

    let gettersProxy: any = null;

    const paneModel = new Proxy(parentModel, {
      get: (target, prop) => {
        if (prop === "getters") {
          if (!gettersProxy) {
            gettersProxy = new Proxy(target.getters, {
              get: (gettersTarget, gettersProp) => {
                if (gettersProp === "getActiveSheetId") {
                  return () => this.props.sheetId;
                }
                // For the focused pane, let all other getters pass through unchanged.
                // The focused pane uses the global (unprefixed) viewport, which keeps it in sync
                // with direct model.getters calls (e.g. in test helpers, selection plugin, etc.).
                if (this.props.isFocused) {
                  return getBoundMethod(gettersTarget, gettersProp);
                }
                if (gettersProp === "getSelectedZones" && !this.props.isFocused) {
                  return () =>
                    (gettersTarget as any).getSelectionForSheet(this.props.sheetId).zones;
                }
                if (gettersProp === "getSelectedZone" && !this.props.isFocused) {
                  return () =>
                    (gettersTarget as any).getSelectionForSheet(this.props.sheetId).anchor.zone;
                }
                if (gettersProp === "getSelection" && !this.props.isFocused) {
                  return () => (gettersTarget as any).getSelectionForSheet(this.props.sheetId);
                }
                if (gettersProp === "getVisibleGroupLayers" && !this.props.isFocused) {
                  return (sheetId: UID, dim: unknown) =>
                    (gettersTarget as any).getVisibleGroupLayers(this.props.sheetId, dim);
                }
                if (gettersProp === "getMainViewportRect") {
                  return () =>
                    (gettersTarget as any).getMainViewportRect(
                      this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getActiveSheetScrollInfo") {
                  return () =>
                    (gettersTarget as any).getActiveSheetScrollInfo(
                      this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getSheetViewVisibleCols") {
                  return () =>
                    (gettersTarget as any).getSheetViewVisibleCols(
                      this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getSheetViewVisibleRows") {
                  return () =>
                    (gettersTarget as any).getSheetViewVisibleRows(
                      this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getMaximumSheetOffset") {
                  return () =>
                    (gettersTarget as any).getMaximumSheetOffset(
                      this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getActiveMainViewport") {
                  return () =>
                    (gettersTarget as any).getActiveMainViewport(
                      this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getEdgeScrollCol") {
                  return (x: number, previousX: number, startingX: number) =>
                    (gettersTarget as any).getEdgeScrollCol(
                      x,
                      previousX,
                      startingX,
                      this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getEdgeScrollRow") {
                  return (y: number, previousY: number, startingY: number) =>
                    (gettersTarget as any).getEdgeScrollRow(
                      y,
                      previousY,
                      startingY,
                      this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getMainViewportCoordinates") {
                  return () =>
                    (gettersTarget as any).getMainViewportCoordinates(
                      this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getVisibleRect") {
                  return (zone: Zone) =>
                    (gettersTarget as any).getVisibleRect(
                      zone,
                      this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getVisibleRectWithoutHeaders") {
                  return (zone: Zone) =>
                    (gettersTarget as any).getVisibleRectWithoutHeaders(
                      zone,
                      this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getVisibleRectWithZoom") {
                  return (zone: Zone) =>
                    (gettersTarget as any).getVisibleRectWithZoom(
                      zone,
                      this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getRect") {
                  return (zone: Zone) =>
                    (gettersTarget as any).getRect(zone, this.props.sheetId, this.props.paneId);
                }
                if (gettersProp === "getVisibleCellPositions") {
                  return () =>
                    (gettersTarget as any).getVisibleCellPositions(
                      this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getAllActiveViewportsZonesAndRect") {
                  return () =>
                    (gettersTarget as any).getAllActiveViewportsZonesAndRect(
                      this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getSheetViewDimension") {
                  return () =>
                    (gettersTarget as any).getSheetViewDimension(
                      this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getSheetViewDimensionWithHeaders") {
                  return () =>
                    (gettersTarget as any).getSheetViewDimensionWithHeaders(
                      this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getGridOffset") {
                  return () =>
                    (gettersTarget as any).getGridOffset(this.props.sheetId, this.props.paneId);
                }
                if (gettersProp === "getColDimensionsInViewport") {
                  return (sheetId: UID, col: number) =>
                    (gettersTarget as any).getColDimensionsInViewport(
                      this.props.sheetId,
                      col,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getRowDimensionsInViewport") {
                  return (sheetId: UID, row: number) =>
                    (gettersTarget as any).getRowDimensionsInViewport(
                      this.props.sheetId,
                      row,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getVisibleFigures") {
                  return (sheetId?: UID) =>
                    (gettersTarget as any).getVisibleFigures(
                      sheetId ?? this.props.sheetId,
                      this.props.paneId
                    );
                }
                if (gettersProp === "getPositionAnchorOffset") {
                  return (position: PixelPosition) =>
                    (gettersTarget as any).getPositionAnchorOffset(position, this.props.paneId);
                }
                if (gettersProp === "isPixelPositionVisible") {
                  return (position: PixelPosition) =>
                    (gettersTarget as any).isPixelPositionVisible(position, this.props.paneId);
                }
                if (gettersProp === "getColIndex") {
                  return (x: number) => (gettersTarget as any).getColIndex(x, this.props.paneId);
                }
                if (gettersProp === "getRowIndex") {
                  return (y: number) => (gettersTarget as any).getRowIndex(y, this.props.paneId);
                }
                return getBoundMethod(gettersTarget, gettersProp);
              },
            });
          }
          return gettersProxy;
        }

        if (prop === "dispatch") {
          return (action: string, payload?: any) => {
            if (typeof action !== "string") {
              return target.dispatch(action as any, payload);
            }

            if (!this.props.isFocused) {
              if (action === "RESIZE_SHEETVIEW" || action === "SET_VIEWPORT_OFFSET") {
                // Inject sheetId and paneId so the engine updates the per-pane viewport instead of the
                // global active-sheet one.
                return target.dispatch(action as any, {
                  ...payload,
                  sheetId: this.props.sheetId,
                  paneId: this.props.paneId,
                });
              }
              if (action === "SET_ZOOM") {
                // Zoom is global – skip for inactive pane to avoid conflicts
                return;
              }
              if (action === "ACTIVATE_SHEET") {
                this.props.onFocus();
              }
            }
            return target.dispatch(action as any, payload);
          };
        }

        if (prop === "selection" && !this.props.isFocused) {
          // Proxy the selection stream processor so that operations on the inactive pane
          // are stored as inactive-sheet selections (via SET_INACTIVE_SHEET_SELECTION)
          // rather than mutating the focused sheet's live selection.
          const sheetId = this.props.sheetId;
          const baseSelection = (target as any).selection;

          return new Proxy(baseSelection, {
            get: (selTarget: any, selProp: string | symbol) => {
              if (typeof selTarget[selProp] !== "function") {
                return selTarget[selProp];
              }
              if (
                selProp === "selectCell" ||
                selProp === "selectZone" ||
                selProp === "moveAnchorCell" ||
                selProp === "updateAnchorCell" ||
                selProp === "setAnchorCorner" ||
                selProp === "addCellToSelection" ||
                selProp === "resizeAnchorZone" ||
                selProp === "selectColumn" ||
                selProp === "selectRow" ||
                selProp === "selectAll" ||
                selProp === "loopSelection" ||
                selProp === "selectTableAroundSelection" ||
                selProp === "commitSelection"
              ) {
                return (...args: any[]) => {
                  // For the inactive pane we directly store the desired selection
                  // without going through the global selection stream processor.
                  // The simplest approach: calculate what the result would be and
                  // dispatch it.
                  const currentSel = target.getters.getSelectionForSheet(sheetId);
                  let newAnchor = currentSel.anchor;
                  let newZones = currentSel.zones;

                  if (selProp === "selectCell") {
                    const [col, row] = args as [number, number];
                    newAnchor = {
                      cell: { col, row },
                      zone: { left: col, right: col, top: row, bottom: row },
                    };
                    newZones = [newAnchor.zone];
                  } else if (selProp === "selectZone") {
                    const anchorZone = args[0] as { cell: { col: number; row: number }; zone: any };
                    newAnchor = { cell: anchorZone.cell, zone: anchorZone.zone };
                    newZones = [anchorZone.zone];
                  } else if (selProp === "selectAll") {
                    const nCols = target.getters.getNumberCols(sheetId);
                    const nRows = target.getters.getNumberRows(sheetId);
                    newAnchor = {
                      cell: { col: 0, row: 0 },
                      zone: { left: 0, right: nCols - 1, top: 0, bottom: nRows - 1 },
                    };
                    newZones = [newAnchor.zone];
                  } else if (selProp === "selectColumn") {
                    const [index] = args as [number];
                    const nRows = target.getters.getNumberRows(sheetId);
                    newAnchor = {
                      cell: { col: index, row: 0 },
                      zone: { left: index, right: index, top: 0, bottom: nRows - 1 },
                    };
                    newZones = [newAnchor.zone];
                  } else if (selProp === "selectRow") {
                    const [index] = args as [number];
                    const nCols = target.getters.getNumberCols(sheetId);
                    newAnchor = {
                      cell: { col: 0, row: index },
                      zone: { left: 0, right: nCols - 1, top: index, bottom: index },
                    };
                    newZones = [newAnchor.zone];
                  }
                  // For complex operations (moveAnchorCell, updateAnchorCell, etc.) that require
                  // engine state, fall back to a no-op for now (the focused pane owns movement).
                  // We always dispatch the new selection.
                  target.dispatch("SET_INACTIVE_SHEET_SELECTION" as any, {
                    sheetId,
                    anchor: newAnchor,
                    zones: newZones,
                  });
                  // Return a trivial DispatchResult-like object.
                  return { isSuccessful: true, reasons: [] };
                };
              }
              // For other methods (observe, capture, etc.) forward to the real selection.
              return typeof selTarget[selProp] === "function"
                ? selTarget[selProp].bind(selTarget)
                : selTarget[selProp];
            },
          });
        }

        return getBoundMethod(target, prop);
      },
    });

    const container = new ScopedDependencyContainer(
      (this.env as any).__spreadsheet_stores__,
      new Set([ModelStore, RendererStore, GridRenderer])
    );

    container.inject(ModelStore, paneModel);
    if (this.props.exposeContainer) {
      this.props.exposeContainer(container);
    }

    this.renderComponent = batched((force?: any) => {
      if (status(this) === "mounted") {
        this.render(force);
      }
    });

    container.on("store-updated", this, this.renderComponent);

    onWillUnmount(() => {
      container.off("store-updated", this);
      container.dispose();
    });

    useSubEnv({
      model: paneModel,
      __spreadsheet_stores__: container,
      getStore: (Store: any) => {
        const store = container.get(Store);
        const owningContainer = container.getOwningContainer(Store);
        return proxifyStoreMutation(store as any, () => {
          owningContainer.trigger("store-updated");
        });
      },
    });
  }

  get isWhiteboard() {
    return this.env.model.getters.getSheet(this.props.sheetId).isWhiteboard;
  }

  get activeCustomFunction() {
    return this.props.isFocused !== false ? this.customFunctionTabStore.activeTab : null;
  }

  get activeWhiteboard() {
    return this.isWhiteboard
      ? this.props.sheetId
      : this.props.isFocused !== false
      ? this.whiteboardTabStore.activeTab
      : null;
  }

  focusGrid() {
    this.props.onFocus();
    if (!this._focusGrid) {
      return;
    }
    this._focusGrid();
  }

  get gridContainerStyle(): string {
    const gridColSize = GROUP_LAYER_WIDTH * this.rowLayers.length;
    const gridRowSize = GROUP_LAYER_WIDTH * this.colLayers.length;
    const zoom = this.env.model.getters.getViewportZoomLevel();
    return cssPropertiesToCss({
      "grid-template-columns": `${gridColSize ? gridColSize + 2 : 0}px auto`, // +2: margins
      "grid-template-rows": `${gridRowSize ? gridRowSize + 2 : 0}px auto`,
      zoom: `${zoom} `,
    });
  }

  get rowLayers(): HeaderGroup[][] {
    return this.env.model.getters.getVisibleGroupLayers(this.props.sheetId, "ROW");
  }

  get colLayers(): HeaderGroup[][] {
    return this.env.model.getters.getVisibleGroupLayers(this.props.sheetId, "COL");
  }

  getGridSize() {
    const el = this.gridContainerRef.el;
    if (!el) {
      return { width: 0, height: 0 };
    }
    const elRect = el.getBoundingClientRect();
    const zoom = this.env.model.getters.getViewportZoomLevel();
    const scrollbarWidth = this.env.model.getters.getScrollBarWidth();

    const colGroupHeight =
      el.querySelector(".o-column-groups")?.getBoundingClientRect().height || 0;

    const gridWidth = elRect.width;
    const gridHeight = elRect.height - colGroupHeight;

    return {
      width: Math.round(Math.max(gridWidth / zoom - scrollbarWidth, 0)),
      height: Math.round(Math.max(gridHeight / zoom - scrollbarWidth, 0)),
    };
  }
}
