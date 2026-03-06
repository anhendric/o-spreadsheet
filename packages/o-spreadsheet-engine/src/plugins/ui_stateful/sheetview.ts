import { getDefaultSheetViewSize, SCROLLBAR_WIDTH } from "../../constants";
import { clip, isDefined, range } from "../../helpers";
import { scrollDelay } from "../../helpers/edge_scrolling";
import { InternalViewport } from "../../helpers/internal_viewport";
import { findCellInNewZone, isEqual, positionToZone } from "../../helpers/zones";
import {
  Command,
  CommandResult,
  invalidateEvaluationCommands,
  LocalCommand,
  ResizeViewportCommand,
  SetViewportOffsetCommand,
} from "../../types/commands";
import { SelectionEvent } from "../../types/event_stream";
import { AnchorOffset, Figure, FigureUI } from "../../types/figure";
import {
  CellPosition,
  Dimension,
  HeaderDimensions,
  HeaderIndex,
  Pixel,
  PixelPosition,
  Position,
  UID,
  Zone,
} from "../../types/misc";
import {
  DOMCoordinates,
  DOMDimension,
  EdgeScrollInfo,
  Rect,
  ScrollDirection,
  SheetDOMScrollInfo,
  Viewport,
} from "../../types/rendering";
import { UIPlugin } from "../ui_plugin";

type SheetViewports = {
  topLeft: InternalViewport | undefined;
  bottomLeft: InternalViewport | undefined;
  topRight: InternalViewport | undefined;
  bottomRight: InternalViewport;
};

/**
 *   EdgeScrollCases Schema
 *
 *  The dots/double dots represent a freeze (= a split of viewports)
 *  In this example, we froze vertically between columns D and E
 *  and horizontally between rows 4 and 5.
 *
 *  One can see that we scrolled horizontally from column E to G and
 *  vertically from row 5 to 7.
 *
 *     A  B  C  D   G  H  I  J  K  L  M  N  O  P  Q  R  S  T
 *     _______________________________________________________
 *  1 |           :                                           |
 *  2 |           :                                           |
 *  3 |           :        B   ↑                 6            |
 *  4 |           :        |   |                 |            |
 *     ····················+···+·················+············|
 *  7 |           :        |   |                 |            |
 *  8 |           :        ↓   2                 |            |
 *  9 |           :                              |            |
 * 10 |       A --+--→                           |            |
 * 11 |           :                              |            |
 * 12 |           :                              |            |
 * 13 |        ←--+-- 1                          |            |
 * 14 |           :                              |        3 --+--→
 * 15 |           :                              |            |
 * 16 |           :                              |            |
 * 17 |       5 --+-------------------------------------------+--→
 * 18 |           :                              |            |
 * 19 |           :                  4           |            |
 * 20 |           :                  |           |            |
 *     ______________________________+___________| ____________
 *                                   |           |
 *                                   ↓           ↓
 */

/**
 * Viewport plugin.
 *
 * This plugin manages all things related to all viewport states.
 *
 */
export class SheetViewPlugin extends UIPlugin {
  static getters = [
    "getColIndex",
    "getRowIndex",
    "getActiveMainViewport",
    "getSheetViewDimension",
    "getSheetViewDimensionWithHeaders",
    "getMainViewportRect",
    "isVisibleInViewport",
    "getEdgeScrollCol",
    "getEdgeScrollRow",
    "getVisibleFigures",
    "getVisibleRect",
    "getVisibleRectWithoutHeaders",
    "getVisibleRectWithZoom",
    "getVisibleCellPositions",
    "getColRowOffsetInViewport",
    "getMainViewportCoordinates",
    "getActiveSheetScrollInfo",
    "getSheetViewVisibleCols",
    "getSheetViewVisibleRows",
    "getFrozenSheetViewRatio",
    "isPixelPositionVisible",
    "getColDimensionsInViewport",
    "getRowDimensionsInViewport",
    "getAllActiveViewportsZonesAndRect",
    "getRect",
    "getFigureUI",
    "getPositionAnchorOffset",
    "getGridOffset",
    "getViewportZoomLevel",
    "getScrollBarWidth",
    "getMaximumSheetOffset",
  ] as const;

  private viewports: Record<string, SheetViewports | undefined> = {};

  /**
   * The viewport dimensions are usually set by one of the components
   * (i.e. when grid component is mounted) to properly reflect its state in the DOM.
   * In the absence of a component (standalone model), is it mandatory to set reasonable default values
   * to ensure the correct operation of this plugin.
   */
  private sheetViewWidth: Pixel = getDefaultSheetViewSize();
  private sheetViewHeight: Pixel = getDefaultSheetViewSize();
  private gridOffsetX: Pixel = 0;
  private gridOffsetY: Pixel = 0;
  private zoomLevel: number = 1;

  /**
   * Per-sheet viewport sizes. Used when a sheetId is provided in RESIZE_SHEETVIEW.
   * If a sheet has no entry here, the shared sheetViewWidth/Height are used.
   */
  private sheetViewSizes: Record<
    string,
    { width: Pixel; height: Pixel; gridOffsetX: Pixel; gridOffsetY: Pixel }
  > = {};

  private sheetsWithDirtyViewports: Set<UID> = new Set();
  private shouldAdjustViewports: boolean = false;

  // ---------------------------------------------------------------------------
  // Command Handling
  // ---------------------------------------------------------------------------

  allowDispatch(cmd: LocalCommand): CommandResult | CommandResult[] {
    switch (cmd.type) {
      case "SET_VIEWPORT_OFFSET":
        return this.chainValidations(
          this.checkScrollingDirection,
          this.checkIfViewportsWillChange
        )(cmd);
      case "RESIZE_SHEETVIEW":
        // Per-sheet resize (from a non-focused pane) always allowed as long as dimensions are valid
        if (cmd.sheetId) {
          return this.checkPositiveDimension(cmd);
        }
        return this.chainValidations(
          this.checkValuesAreDifferent,
          this.checkPositiveDimension
        )(cmd);
      case "SET_ZOOM":
        if (cmd.zoom > 2 || cmd.zoom < 0.5) {
          return CommandResult.InvalidZoomLevel;
        } else {
          return CommandResult.Success;
        }
      default:
        return CommandResult.Success;
    }
  }

  private handleEvent(event: SelectionEvent) {
    const sheetId = this.getters.getActiveSheetId();
    if (event.options.scrollIntoView) {
      const oldZone = event.previousAnchor.zone;
      const newZone = event.anchor.zone;
      const isUpdateAnchorEvent = event.mode === "updateAnchor";
      const sameZone = isEqual(oldZone, newZone);
      let { col, row } =
        isUpdateAnchorEvent && sameZone ? event.anchor.cell : findCellInNewZone(oldZone, newZone);
      if (isUpdateAnchorEvent && !sameZone) {
        // altering a zone should not move the viewport in a dimension that wasn't changed
        const { top, bottom, left, right } = this.getMainInternalViewport(sheetId);
        if (oldZone.left === newZone.left && oldZone.right === newZone.right) {
          col = left > col || col > right ? left : col;
        }
        if (oldZone.top === newZone.top && oldZone.bottom === newZone.bottom) {
          row = top > row || row > bottom ? top : row;
        }
      }
      col = Math.min(col, this.getters.getNumberCols(sheetId) - 1);
      row = Math.min(row, this.getters.getNumberRows(sheetId) - 1);
      if (!this.sheetsWithDirtyViewports.has(sheetId)) {
        this.refreshViewport(this.getters.getActiveSheetId(), { col, row });
      }
    }
  }

  handle(cmd: Command) {
    // changing the evaluation can hide/show rows because of data filters
    if (invalidateEvaluationCommands.has(cmd.type)) {
      for (const sheetId of this.getters.getSheetIds()) {
        this.sheetsWithDirtyViewports.add(sheetId);
      }
    }

    switch (cmd.type) {
      case "START":
        this.selection.observe(this, {
          handleEvent: this.handleEvent.bind(this),
        });
        this.resetViewports(this.getters.getActiveSheetId());
        break;
      case "UNDO":
      case "REDO":
        this.cleanViewports();
        for (const sheetId of this.getters.getSheetIds()) {
          this.sheetsWithDirtyViewports.add(sheetId);
        }
        this.shouldAdjustViewports = true;
        break;
      case "RESIZE_SHEETVIEW":
        if (cmd.sheetId) {
          const key = this.getViewportKey(cmd.sheetId, cmd.paneId);
          this.sheetViewSizes[key] = {
            width: cmd.width,
            height: cmd.height,
            gridOffsetX: cmd.gridOffsetX ?? 0,
            gridOffsetY: cmd.gridOffsetY ?? 0,
          };
          this.sheetsWithDirtyViewports.add(cmd.sheetId);
        } else {
          this.resizeSheetView(cmd.height, cmd.width, cmd.gridOffsetX, cmd.gridOffsetY);
        }
        break;
      case "SET_VIEWPORT_OFFSET":
        if (cmd.sheetId) {
          this.setSheetViewOffsetForSheet(cmd.sheetId, cmd.offsetX, cmd.offsetY, cmd.paneId);
        } else {
          this.setSheetViewOffset(cmd.offsetX, cmd.offsetY);
        }
        break;
      case "SET_ZOOM":
        this.zoomLevel = cmd.zoom || 1;
        break;
      case "SHIFT_VIEWPORT_DOWN":
        const sheetId = this.getters.getActiveSheetId();
        const { top, viewportHeight, offsetCorrectionY } = this.getMainInternalViewport(sheetId);
        const topRowDims = this.getters.getRowDimensions(sheetId, top);
        this.shiftVertically(topRowDims.start + viewportHeight - offsetCorrectionY);
        break;
      case "SHIFT_VIEWPORT_UP": {
        const sheetId = this.getters.getActiveSheetId();
        const { top, viewportHeight, offsetCorrectionY } = this.getMainInternalViewport(sheetId);
        const topRowDims = this.getters.getRowDimensions(sheetId, top);
        this.shiftVertically(topRowDims.end - offsetCorrectionY - viewportHeight);
        break;
      }
      case "REMOVE_TABLE":
      case "UPDATE_TABLE":
      case "UPDATE_FILTER":
      case "UNFREEZE_ROWS":
      case "UNFREEZE_COLUMNS":
      case "FREEZE_COLUMNS":
      case "FREEZE_ROWS":
      case "UNFREEZE_COLUMNS_ROWS":
      case "REMOVE_COLUMNS_ROWS":
      case "RESIZE_COLUMNS_ROWS":
      case "HIDE_COLUMNS_ROWS":
      case "ADD_COLUMNS_ROWS":
      case "UNHIDE_COLUMNS_ROWS":
      case "UNGROUP_HEADERS":
      case "GROUP_HEADERS":
      case "FOLD_HEADER_GROUP":
      case "UNFOLD_HEADER_GROUP":
      case "FOLD_HEADER_GROUPS_IN_ZONE":
      case "UNFOLD_HEADER_GROUPS_IN_ZONE":
      case "UNFOLD_ALL_HEADER_GROUPS":
      case "FOLD_ALL_HEADER_GROUPS":
        this.sheetsWithDirtyViewports.add(cmd.sheetId);
        break;
      case "UPDATE_CELL":
        // update cell content or format can change hidden rows because of data filters
        if ("content" in cmd || "format" in cmd || cmd.style?.fontSize !== undefined) {
          for (const sheetId of this.getters.getSheetIds()) {
            this.sheetsWithDirtyViewports.add(sheetId);
          }
        }
        break;
      case "DELETE_SHEET":
        this.cleanViewports();
        this.sheetsWithDirtyViewports.delete(cmd.sheetId);
        break;
      case "ACTIVATE_SHEET":
        this.sheetsWithDirtyViewports.add(cmd.sheetIdTo);
        break;
      case "SCROLL_TO_CELL":
        this.refreshViewport(
          this.getters.getActiveSheetId(),
          { col: cmd.col, row: cmd.row },
          cmd.paneId
        );
        break;
    }
  }

  finalize() {
    for (const sheetId of this.sheetsWithDirtyViewports) {
      const keys = Object.keys(this.viewports).filter(
        (key) => key === sheetId || key.startsWith(`${sheetId}-`)
      );
      if (keys.length === 0) {
        this.resetViewports(sheetId);
      } else {
        for (const key of keys) {
          const paneId = key === sheetId ? undefined : key.split("-")[1];
          this.resetViewports(sheetId, paneId);
        }
      }
      if (this.shouldAdjustViewports) {
        const position = this.getters.getSheetPosition(sheetId);
        const keys = Object.keys(this.viewports).filter(
          (key) => key === sheetId || key.startsWith(`${sheetId}-`)
        );
        for (const key of keys) {
          const paneId = key === sheetId ? undefined : key.split("-")[1];
          this.getSubViewports(sheetId, paneId).forEach((viewport) => {
            viewport.adjustPosition(position);
          });
        }
      }
    }
    this.sheetsWithDirtyViewports = new Set();
    this.shouldAdjustViewports = false;
    this.setViewports();
  }

  private setViewports() {
    const sheetIds = this.getters.getSheetIds();
    for (const sheetId of sheetIds) {
      if (!this.viewports[sheetId]?.bottomRight) {
        this.resetViewports(sheetId);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Getters
  // ---------------------------------------------------------------------------

  /**
   * Return the index of a column given an offset x, based on the viewport left
   * visible cell.
   * It returns -1 if no column is found.
   */
  getColIndex(x: Pixel, paneId?: string): HeaderIndex {
    const sheetId = this.getters.getActiveSheetId();
    return Math.max(
      ...this.getSubViewports(sheetId, paneId).map((viewport) => viewport.getColIndex(x))
    );
  }

  /**
   * Return the index of a row given an offset y, based on the viewport top
   * visible cell.
   * It returns -1 if no row is found.
   */
  getRowIndex(y: Pixel, paneId?: string): HeaderIndex {
    const sheetId = this.getters.getActiveSheetId();
    return Math.max(
      ...this.getSubViewports(sheetId, paneId).map((viewport) => viewport.getRowIndex(y))
    );
  }

  getSheetViewDimensionWithHeaders(sheetId?: UID, paneId?: string): DOMDimension {
    const { width, height, gridOffsetX, gridOffsetY } = this.getSheetViewSizes(sheetId, paneId);
    return {
      width: width + gridOffsetX,
      height: height + gridOffsetY,
    };
  }

  getSheetViewDimension(sheetId?: UID, paneId?: string): DOMDimension {
    const { width, height } = this.getSheetViewSizes(sheetId, paneId);
    return {
      width,
      height,
    };
  }

  getGridOffset(sheetId?: UID, paneId?: string): DOMCoordinates {
    const { gridOffsetX, gridOffsetY } = this.getSheetViewSizes(sheetId, paneId);
    return { x: gridOffsetX, y: gridOffsetY };
  }

  /** type as pane, not viewport but basically pane extends viewport */
  getActiveMainViewport(sheetId?: UID, paneId?: string): Viewport {
    const sid = sheetId ?? this.getters.getActiveSheetId();
    return this.getMainViewport(sid, paneId);
  }

  /**
   * Return the DOM scroll info of the active sheet, ie. the offset between the viewport left/top side and
   * the grid left/top side, corresponding to the scroll of the scrollbars and not snapped to the grid.
   */
  getActiveSheetScrollInfo(sheetId?: UID, paneId?: string): SheetDOMScrollInfo {
    const sid = sheetId ?? this.getters.getActiveSheetId();
    const viewport = this.getMainInternalViewport(sid, paneId);
    return {
      scrollX: viewport.offsetX,
      scrollY: viewport.offsetY,
    };
  }

  getSheetViewVisibleCols(sheetId?: UID, paneId?: string): HeaderIndex[] {
    const sid = sheetId ?? this.getters.getActiveSheetId();
    const viewports = this.getSubViewports(sid, paneId);

    //TODO ake another commit to eimprove this
    return [...new Set(viewports.map((v) => range(v.left, v.right + 1)).flat())].filter(
      (col) => col >= 0 && !this.getters.isHeaderHidden(sid, "COL", col)
    );
  }

  getSheetViewVisibleRows(sheetId?: UID, paneId?: string): HeaderIndex[] {
    const sid = sheetId ?? this.getters.getActiveSheetId();
    const viewports = this.getSubViewports(sid, paneId);
    return [...new Set(viewports.map((v) => range(v.top, v.bottom + 1)).flat())].filter(
      (row) => row >= 0 && !this.getters.isHeaderHidden(sid, "ROW", row)
    );
  }

  /**
   * Get the positions of all the cells that are visible in the viewport, taking merges into account.
   */
  getVisibleCellPositions(sheetId?: UID, paneId?: string): CellPosition[] {
    const sid = sheetId ?? this.getters.getActiveSheetId();
    const visibleCols = this.getSheetViewVisibleCols(sid, paneId);
    const visibleRows = this.getSheetViewVisibleRows(sid, paneId);

    const positions: CellPosition[] = [];
    for (const col of visibleCols) {
      for (const row of visibleRows) {
        const position = { sheetId: sid, col, row };
        const mainPosition = this.getters.getMainCellPosition(position);
        if (mainPosition.row !== row || mainPosition.col !== col) {
          continue;
        }
        positions.push(position);
      }
    }
    return positions;
  }

  /**
   * Return the main viewport maximum size relative to the client size.
   */
  getMainViewportRect(sheetId?: UID, paneId?: string): Rect {
    const sid = sheetId ?? this.getters.getActiveSheetId();
    const viewport = this.getMainInternalViewport(sid, paneId);
    const { xSplit, ySplit } = this.getters.getPaneDivisions(sid);
    const { width, height } = viewport.getMaxSize();
    const x = this.getters.getColDimensions(sid, xSplit).start;
    const y = this.getters.getRowDimensions(sid, ySplit).start;
    return { x, y, width, height };
  }

  getMaximumSheetOffset(sheetId?: UID, paneId?: string): { maxOffsetX: Pixel; maxOffsetY: Pixel } {
    const sid = sheetId ?? this.getters.getActiveSheetId();
    const { width, height } = this.getMainViewportRect(sid, paneId);
    const viewport = this.getMainInternalViewport(sid, paneId);
    return {
      maxOffsetX: Math.max(0, width - viewport.viewportWidth),
      maxOffsetY: Math.max(0, height - viewport.viewportHeight),
    };
  }

  getColRowOffsetInViewport(
    dimension: Dimension,
    referenceHeaderIndex: HeaderIndex,
    targetHeaderIndex: HeaderIndex,
    sheetId?: UID,
    paneId?: string
  ): Pixel {
    if (targetHeaderIndex < referenceHeaderIndex) {
      return -this.getColRowOffsetInViewport(
        dimension,
        targetHeaderIndex,
        referenceHeaderIndex,
        sheetId,
        paneId
      );
    }

    const sid = sheetId ?? this.getters.getActiveSheetId();
    const visibleHeaders =
      dimension === "COL"
        ? this.getSheetViewVisibleCols(sid, paneId)
        : this.getSheetViewVisibleRows(sid, paneId);
    const startIndex = visibleHeaders.findIndex((header) => referenceHeaderIndex >= header);
    let endIndex = visibleHeaders.findIndex((header) => targetHeaderIndex <= header);
    endIndex = endIndex === -1 ? visibleHeaders.length : endIndex;
    const relevantIndexes = visibleHeaders.slice(startIndex, endIndex);
    let offset = 0;
    for (const i of relevantIndexes) {
      offset += this.getters.getHeaderSize(sid, dimension, i);
    }
    return offset * this.zoomLevel;
  }

  /**
   * Check if a given position is visible in the viewport.
   */
  isVisibleInViewport({ sheetId, col, row }: CellPosition, paneId?: string): boolean {
    return this.getSubViewports(sheetId, paneId).some((pane) => pane.isVisible(col, row));
  }

  getScrollBarWidth(): Pixel {
    return SCROLLBAR_WIDTH / this.zoomLevel;
  }

  // => returns the new offset
  getEdgeScrollCol(
    x: number,
    previousX: number,
    startingX: number,
    sheetId?: UID,
    paneId?: string
  ): EdgeScrollInfo {
    let canEdgeScroll = false;
    let direction: ScrollDirection = 0;
    let delay = 0;
    /** 4 cases : See EdgeScrollCases Schema at the top
     * 1. previous in XRight > XLeft
     * 3. previous in XRight > outside
     * 5. previous in Left > outside
     * A. previous in Left > right
     * with X a position taken in the bottomRIght (aka scrollable) viewport
     */
    const sid = sheetId ?? this.getters.getActiveSheetId();
    const { xSplit } = this.getters.getPaneDivisions(sid);
    const { width } = this.getSheetViewDimension(sid, paneId);
    const { x: offsetCorrectionX } = this.getMainViewportCoordinates(sid, paneId);
    const currentOffsetX = this.getActiveSheetScrollInfo(sid, paneId).scrollX;

    if (x > width) {
      // 3 & 5
      canEdgeScroll = true;
      delay = scrollDelay(x - width);
      direction = 1;
    } else if (x < offsetCorrectionX && startingX >= offsetCorrectionX && currentOffsetX > 0) {
      // 1
      canEdgeScroll = true;
      delay = scrollDelay(offsetCorrectionX - x);
      direction = -1;
    } else if (xSplit && previousX < offsetCorrectionX && x > offsetCorrectionX) {
      // A
      canEdgeScroll = true;
      delay = scrollDelay(x);
      direction = "reset";
    }
    return { canEdgeScroll, direction, delay };
  }

  getEdgeScrollRow(
    y: number,
    previousY: number,
    startingY: number,
    sheetId?: UID,
    paneId?: string
  ): EdgeScrollInfo {
    let canEdgeScroll = false;
    let direction: ScrollDirection = 0;
    let delay = 0;
    /** 4 cases : See EdgeScrollCases Schema at the top
     * 2. previous in XBottom > XTop
     * 4. previous in XRight > outside
     * 6. previous in Left > outside
     * B. previous in Left > right
     * with X a position taken in the bottomRIght (aka scrollable) viewport
     */
    const sid = sheetId ?? this.getters.getActiveSheetId();
    const { ySplit } = this.getters.getPaneDivisions(sid);

    const { height } = this.getSheetViewDimension(sid, paneId);
    const { y: offsetCorrectionY } = this.getMainViewportCoordinates(sid, paneId);
    const currentOffsetY = this.getActiveSheetScrollInfo(sid, paneId).scrollY;

    if (y > height) {
      // 4 & 6
      canEdgeScroll = true;
      delay = scrollDelay(y - height);
      direction = 1;
    } else if (y < offsetCorrectionY && startingY >= offsetCorrectionY && currentOffsetY > 0) {
      // 2
      canEdgeScroll = true;
      delay = scrollDelay(offsetCorrectionY - y);
      direction = -1;
    } else if (ySplit && previousY < offsetCorrectionY && y > offsetCorrectionY) {
      // B
      canEdgeScroll = true;
      delay = scrollDelay(y);
      direction = "reset";
    }
    return { canEdgeScroll, direction, delay };
  }

  /**
   * Computes the coordinates and size to draw the zone on the canvas
   */
  getVisibleRect(zone: Zone, sheetId?: UID, paneId?: string): Rect {
    const rect = this.getVisibleRectWithoutHeaders(zone, sheetId, paneId);
    const { gridOffsetX, gridOffsetY } = this.getSheetViewSizes(sheetId, paneId);
    return { ...rect, x: rect.x + gridOffsetX, y: rect.y + gridOffsetY };
  }

  /**
   * Computes the coordinates and size to draw the zone on the canvas after it has been zoomed
   */
  getVisibleRectWithZoom(zone: Zone, sheetId?: UID, paneId?: string): Rect {
    const zoom = this.getViewportZoomLevel();
    const rect = this.getVisibleRectWithoutHeaders(zone, sheetId, paneId);
    const { gridOffsetX, gridOffsetY } = this.getSheetViewSizes(sheetId, paneId);
    rect.width = rect.width * zoom;
    rect.height = rect.height * zoom;
    rect.x = rect.x * zoom + gridOffsetX * zoom;
    rect.y = rect.y * zoom + gridOffsetY * zoom;
    return rect;
  }

  /**
   * Computes the coordinates and size to draw the zone without taking the grid offset into account
   */
  getVisibleRectWithoutHeaders(zone: Zone, sheetId?: UID, paneId?: string): Rect {
    const sid = sheetId ?? this.getters.getActiveSheetId();
    return this.mapViewportsToRect(sid, (viewport) => viewport.getVisibleRect(zone), paneId);
  }

  /**
   * Computes the actual size and position (:Rect) of the zone on the canvas
   * regardless of the viewport dimensions.
   */
  getRect(zone: Zone, sheetId?: UID, paneId?: string): Rect {
    const sid = sheetId ?? this.getters.getActiveSheetId();
    const { gridOffsetX, gridOffsetY } = this.getSheetViewSizes(sheetId, paneId);
    const rect = this.mapViewportsToRect(sid, (viewport) => viewport.getFullRect(zone), paneId);
    return { ...rect, x: rect.x + gridOffsetX, y: rect.y + gridOffsetY };
  }

  /**
   * Computes the actual size and position (:Rect) of the zone on the canvas
   * regardless of the viewport dimensions.
   */
  getRectWithoutHeaders(zone: Zone, sheetId?: UID, paneId?: string): Rect {
    const sid = sheetId ?? this.getters.getActiveSheetId();
    return this.mapViewportsToRect(sid, (viewport) => viewport.getFullRect(zone), paneId);
  }

  /**
   * Returns the position of the MainViewport relatively to the start of the grid (without headers)
   * It corresponds to the summed dimensions of the visible cols/rows (in x/y respectively)
   * situated before the pane divisions.
   */
  getMainViewportCoordinates(sheetId?: UID, paneId?: string): DOMCoordinates {
    const sid = sheetId ?? this.getters.getActiveSheetId();
    const { xSplit, ySplit } = this.getters.getPaneDivisions(sid);
    const x = this.getters.getColDimensions(sid, xSplit).start;
    const y = this.getters.getRowDimensions(sid, ySplit).start;
    return { x, y };
  }

  /**
   * Returns the size, start and end coordinates of a column relative to the left
   * column of the current viewport
   */
  getColDimensionsInViewport(sheetId: UID, col: HeaderIndex, paneId?: string): HeaderDimensions {
    const { top } = this.getMainInternalViewport(sheetId, paneId);
    const zone = {
      left: col,
      right: col,
      top,
      bottom: top,
    };
    const { x, width } = this.getVisibleRect(zone, sheetId, paneId);
    const { gridOffsetX } = this.getSheetViewSizes(sheetId, paneId);
    const start = x - gridOffsetX;
    return { start, size: width, end: start + width };
  }

  /**
   * Returns the size, start and end coordinates of a row relative to the top row
   * of the current viewport
   */
  getRowDimensionsInViewport(sheetId: UID, row: HeaderIndex, paneId?: string): HeaderDimensions {
    const { left } = this.getMainInternalViewport(sheetId, paneId);
    const zone = {
      left: 0,
      right: left,
      top: row,
      bottom: row,
    };
    const { y, height } = this.getVisibleRect(zone, sheetId, paneId);
    const { gridOffsetY } = this.getSheetViewSizes(sheetId, paneId);
    const start = y - gridOffsetY;
    return { start, size: height, end: start + height };
  }

  getAllActiveViewportsZonesAndRect(sheetId?: UID, paneId?: string): { zone: Zone; rect: Rect }[] {
    const sid = sheetId ?? this.getters.getActiveSheetId();
    const { gridOffsetX, gridOffsetY } = this.getSheetViewSizes(sid, paneId);
    return this.getSubViewports(sid, paneId).map((viewport) => {
      return {
        zone: viewport,
        rect: {
          x: viewport.offsetCorrectionX + gridOffsetX,
          y: viewport.offsetCorrectionY + gridOffsetY,
          ...viewport.getMaxSize(),
        },
      };
    });
  }

  getViewportZoomLevel(): number {
    return this.zoomLevel;
  }

  // ---------------------------------------------------------------------------
  // Private
  // ---------------------------------------------------------------------------

  private getViewportKey(sheetId: UID, paneId?: string): string {
    return paneId ? `${sheetId}-${paneId}` : sheetId;
  }

  private ensureMainViewportExist(sheetId: UID, paneId?: string) {
    const key = this.getViewportKey(sheetId, paneId);
    if (!this.viewports[key]) {
      this.resetViewports(sheetId, paneId);
    }
  }

  private getSubViewports(sheetId: UID, paneId?: string): InternalViewport[] {
    this.ensureMainViewportExist(sheetId, paneId);
    const key = this.getViewportKey(sheetId, paneId);
    return Object.values(this.viewports[key]!).filter(isDefined);
  }

  private checkPositiveDimension(cmd: ResizeViewportCommand) {
    if (cmd.width < 0 || cmd.height < 0) {
      return CommandResult.InvalidViewportSize;
    }
    return CommandResult.Success;
  }

  private checkValuesAreDifferent(cmd: ResizeViewportCommand) {
    const { height, width } = this.getSheetViewDimension();
    if (
      cmd.gridOffsetX === this.gridOffsetX &&
      cmd.gridOffsetY === this.gridOffsetY &&
      cmd.width === width &&
      cmd.height === height
    ) {
      return CommandResult.ValuesNotChanged;
    }
    return CommandResult.Success;
  }

  private checkScrollingDirection({
    offsetX,
    offsetY,
    sheetId: cmdSheetId,
    paneId,
  }: SetViewportOffsetCommand): CommandResult {
    const sid = cmdSheetId ?? this.getters.getActiveSheetId();
    const pane = this.getMainInternalViewport(sid, paneId);
    if (
      (!pane.canScrollHorizontally && offsetX > 0) ||
      (!pane.canScrollVertically && offsetY > 0)
    ) {
      return CommandResult.InvalidScrollingDirection;
    }
    return CommandResult.Success;
  }

  private checkIfViewportsWillChange({
    offsetX,
    offsetY,
    sheetId: cmdSheetId,
    paneId,
  }: SetViewportOffsetCommand) {
    const sheetId = cmdSheetId ?? this.getters.getActiveSheetId();
    const { maxOffsetX, maxOffsetY } = this.getMaximumSheetOffset(sheetId, paneId);
    const willScroll = this.getSubViewports(sheetId, paneId).some((viewport) =>
      viewport.willNewOffsetScrollViewport(
        clip(offsetX, 0, maxOffsetX),
        clip(offsetY, 0, maxOffsetY)
      )
    );
    return willScroll ? CommandResult.Success : CommandResult.ViewportScrollLimitsReached;
  }

  private getMainViewport(sheetId: UID, paneId?: string): Viewport {
    const viewport = this.getMainInternalViewport(sheetId, paneId);
    return {
      top: viewport.top,
      left: viewport.left,
      bottom: viewport.bottom,
      right: viewport.right,
    };
  }

  private getMainInternalViewport(sheetId: UID, paneId?: string): InternalViewport {
    this.ensureMainViewportExist(sheetId, paneId);
    const key = this.getViewportKey(sheetId, paneId);
    return this.viewports[key]!.bottomRight;
  }

  /** gets rid of deprecated sheetIds */
  private cleanViewports() {
    const newViewport = {};
    const sheetIds = new Set(this.getters.getSheetIds());
    for (const key in this.viewports) {
      const sheetId = key.split("-")[0];
      if (sheetIds.has(sheetId)) {
        newViewport[key] = this.viewports[key];
      }
    }
    this.viewports = newViewport;
  }

  private resizeSheetView(
    height: Pixel,
    width: Pixel,
    gridOffsetX: Pixel = 0,
    gridOffsetY: Pixel = 0
  ) {
    this.sheetViewHeight = height;
    this.sheetViewWidth = width;
    this.gridOffsetX = gridOffsetX;
    this.gridOffsetY = gridOffsetY;
    this.recomputeViewports();
  }

  private recomputeViewports() {
    for (const key in this.viewports) {
      const parts = key.split("-");
      const sheetId = parts[0];
      const paneId = parts.length > 1 ? parts[1] : undefined;
      this.resetViewports(sheetId, paneId);
    }
  }

  private setSheetViewOffset(offsetX: Pixel, offsetY: Pixel) {
    const sheetId = this.getters.getActiveSheetId();
    const { maxOffsetX, maxOffsetY } = this.getMaximumSheetOffset();
    this.getSubViewports(sheetId).forEach((viewport) =>
      viewport.setViewportOffset(clip(offsetX, 0, maxOffsetX), clip(offsetY, 0, maxOffsetY))
    );
  }

  private setSheetViewOffsetForSheet(
    sheetId: UID,
    offsetX: Pixel,
    offsetY: Pixel,
    paneId?: string
  ) {
    const { maxOffsetX, maxOffsetY } = this.getMaximumSheetOffset(sheetId, paneId);
    this.getSubViewports(sheetId, paneId).forEach((viewport) =>
      viewport.setViewportOffset(clip(offsetX, 0, maxOffsetX), clip(offsetY, 0, maxOffsetY))
    );
  }

  /**
   * Returns the sheet view sizes for a given sheet. Falls back to the global sizes if no
   * per-sheet size is set for that sheet.
   */
  private getSheetViewSizes(
    sheetId?: UID,
    paneId?: string
  ): {
    width: Pixel;
    height: Pixel;
    gridOffsetX: Pixel;
    gridOffsetY: Pixel;
  } {
    const sid = sheetId ?? this.getters.getActiveSheetId();
    const key = this.getViewportKey(sid, paneId);
    if (this.sheetViewSizes[key]) {
      return this.sheetViewSizes[key];
    }
    return {
      width: this.sheetViewWidth,
      height: this.sheetViewHeight,
      gridOffsetX: this.gridOffsetX,
      gridOffsetY: this.gridOffsetY,
    };
  }

  private getViewportOffset(sheetId: UID, paneId?: string) {
    const key = this.getViewportKey(sheetId, paneId);
    return {
      x: this.viewports[key]?.bottomRight.offsetX || 0,
      y: this.viewports[key]?.bottomRight.offsetY || 0,
    };
  }

  private resetViewports(sheetId: UID, paneId?: string) {
    if (!this.getters.tryGetSheet(sheetId)) {
      return;
    }
    const { xSplit, ySplit } = this.getters.getPaneDivisions(sheetId);
    const nCols = this.getters.getNumberCols(sheetId);
    const nRows = this.getters.getNumberRows(sheetId);
    const { width: svWidth, height: svHeight } = this.getSheetViewSizes(sheetId, paneId);
    const colOffset = Math.min(this.getters.getColRowOffset("COL", 0, xSplit, sheetId), svWidth);
    const rowOffset = Math.min(this.getters.getColRowOffset("ROW", 0, ySplit, sheetId), svHeight);
    const unfrozenWidth = Math.max(svWidth - colOffset, 0);
    const unfrozenHeight = Math.max(svHeight - rowOffset, 0);
    const { xRatio, yRatio } = this.getFrozenSheetViewRatio(sheetId, paneId);
    const canScrollHorizontally = xRatio < 1.0;
    const canScrollVertically = yRatio < 1.0;
    const previousOffset = this.getViewportOffset(sheetId, paneId);

    const sheetViewports: SheetViewports = {
      topLeft:
        (ySplit &&
          xSplit &&
          new InternalViewport(
            this.getters,
            sheetId,
            { left: 0, right: xSplit - 1, top: 0, bottom: ySplit - 1 },
            { width: colOffset, height: rowOffset },
            { canScrollHorizontally: false, canScrollVertically: false },
            { x: 0, y: 0 }
          )) ||
        undefined,
      topRight:
        (ySplit &&
          new InternalViewport(
            this.getters,
            sheetId,
            { left: xSplit, right: nCols - 1, top: 0, bottom: ySplit - 1 },
            { width: unfrozenWidth, height: rowOffset },
            { canScrollHorizontally, canScrollVertically: false },
            { x: canScrollHorizontally ? previousOffset.x : 0, y: 0 }
          )) ||
        undefined,
      bottomLeft:
        (xSplit &&
          new InternalViewport(
            this.getters,
            sheetId,
            { left: 0, right: xSplit - 1, top: ySplit, bottom: nRows - 1 },
            { width: colOffset, height: unfrozenHeight },
            { canScrollHorizontally: false, canScrollVertically },
            { x: 0, y: canScrollVertically ? previousOffset.y : 0 }
          )) ||
        undefined,
      bottomRight: new InternalViewport(
        this.getters,
        sheetId,
        { left: xSplit, right: nCols - 1, top: ySplit, bottom: nRows - 1 },
        {
          width: unfrozenWidth,
          height: unfrozenHeight,
        },
        { canScrollHorizontally, canScrollVertically },
        {
          x: canScrollHorizontally ? previousOffset.x : 0,
          y: canScrollVertically ? previousOffset.y : 0,
        }
      ),
    };
    const key = this.getViewportKey(sheetId, paneId);
    this.viewports[key] = sheetViewports;
  }

  /**
   * Adjust the viewport such that the anchor position is visible
   */
  private refreshViewport(sheetId: UID, anchorPosition: Position, paneId?: string) {
    this.getSubViewports(sheetId, paneId).forEach((viewport) => {
      viewport.adjustViewportZone();
      viewport.adjustPosition(anchorPosition);
    });
  }

  /**
   * Shift the viewport vertically and move the selection anchor
   * such that it remains at the same place relative to the
   * viewport top.
   */
  private shiftVertically(offset: Pixel, paneId?: string) {
    const sheetId = this.getters.getActiveSheetId();
    const { top } = this.getMainInternalViewport(sheetId, paneId);
    const { scrollX } = this.getActiveSheetScrollInfo(sheetId, paneId);
    this.setSheetViewOffsetForSheet(sheetId, scrollX, offset, paneId);
    const { anchor } = this.getters.getSelection();
    if (anchor.cell.row >= this.getters.getPaneDivisions(sheetId).ySplit) {
      const deltaRow = this.getMainInternalViewport(sheetId, paneId).top - top;
      this.selection.selectCell(anchor.cell.col, anchor.cell.row + deltaRow);
    }
  }

  /**
   * Return the index of a col given a negative offset x, based on the main viewport top
   * visible cell of the main viewport.
   * It returns -1 if no col is found.
   */
  private getColIndexLeftOfMainViewport(x: Pixel, paneId?: string): HeaderIndex {
    if (x >= 0) {
      return -1;
    }
    const sheetId = this.getters.getActiveSheetId();
    let col = this.getActiveMainViewport(undefined, paneId).left;
    let colStart =
      -this.getActiveSheetScrollInfo(undefined, paneId).scrollX -
      this.getters.getColRowOffset("COL", col, 0);
    for (; x < colStart; col--) {
      colStart -= this.getters.getColSize(sheetId, col - 1);
    }
    return Math.max(col, 0);
  }

  /**
   * Return the index of a row given a negative offset y, based on the main viewport top
   * visible cell of the main viewport.
   * It returns -1 if no row is found.
   */
  private getRowIndexTopOfMainViewport(y: Pixel, paneId?: string): HeaderIndex {
    if (y >= 0) {
      return -1;
    }
    const sheetId = this.getters.getActiveSheetId();
    let row = this.getActiveMainViewport(undefined, paneId).top;
    let rowStart =
      -this.getActiveSheetScrollInfo(undefined, paneId).scrollY -
      this.getters.getColRowOffset("ROW", row, 0);
    for (; y < rowStart; row--) {
      rowStart -= this.getters.getRowSize(sheetId, row - 1);
    }
    return Math.max(row, 0);
  }

  getVisibleFigures(sheetId?: UID, paneId?: string): FigureUI[] {
    const sid = sheetId ?? this.getters.getActiveSheetId();
    const result: FigureUI[] = [];
    const figures = this.getters.getFigures(sid);
    const { scrollX, scrollY } = this.getActiveSheetScrollInfo(sid, paneId);
    const { x: offsetCorrectionX, y: offsetCorrectionY } = this.getMainViewportCoordinates(
      sid,
      paneId
    );
    const { width, height } = this.getSheetViewDimension(sid, paneId);

    for (const figure of figures) {
      const figureUI = this.getFigureUI(sid, figure);
      const { x, y } = figureUI;
      if (
        x >= offsetCorrectionX &&
        (x + figure.width < scrollX + offsetCorrectionX || x > width + scrollX + offsetCorrectionX)
      ) {
        continue;
      } else if (
        y >= offsetCorrectionY &&
        (y + figure.height < scrollY + offsetCorrectionY ||
          y > height + scrollY + offsetCorrectionY)
      ) {
        continue;
      }
      result.push(figureUI);
    }
    return result;
  }

  getFigureUI(sheetId: UID, figure: Figure): FigureUI {
    const x = figure.offset.x + this.getters.getColDimensions(sheetId, figure.col).start;
    const y = figure.offset.y + this.getters.getRowDimensions(sheetId, figure.row).start;
    return { ...figure, x, y };
  }

  getPositionAnchorOffset(position: PixelPosition, paneId?: string): AnchorOffset {
    const { scrollX, scrollY } = this.getActiveSheetScrollInfo(undefined, paneId);
    const x = position.x - scrollX;
    const y = position.y - scrollY;
    const col =
      x >= 0 ? this.getColIndex(x, paneId) : this.getColIndexLeftOfMainViewport(x, paneId);
    const row = y >= 0 ? this.getRowIndex(y, paneId) : this.getRowIndexTopOfMainViewport(y, paneId);
    const { x: colX, y: rowY } = this.getRect(positionToZone({ col, row }), undefined, paneId);
    const { gridOffsetX, gridOffsetY } = this.getSheetViewSizes(undefined, paneId);
    return {
      col,
      row,
      offset: {
        x: Math.max(x - colX + gridOffsetX, 0),
        y: Math.max(y - rowY + gridOffsetY, 0),
      },
    };
  }

  isPixelPositionVisible(position: PixelPosition, paneId?: string): boolean {
    const { scrollX, scrollY } = this.getActiveSheetScrollInfo(undefined, paneId);
    const { x: mainViewportX, y: mainViewportY } = this.getMainViewportCoordinates(
      undefined,
      paneId
    );
    const { width, height } = this.getSheetViewDimension(undefined, paneId);

    if (
      position.x >= mainViewportX &&
      (position.x < mainViewportX + scrollX || position.x > width + scrollX + mainViewportX)
    ) {
      return false;
    }
    if (
      position.y >= mainViewportY &&
      (position.y < mainViewportY + scrollY || position.y > height + scrollY + mainViewportY)
    ) {
      return false;
    }

    return true;
  }

  getFrozenSheetViewRatio(sheetId: UID, paneId?: string) {
    const { xSplit, ySplit } = this.getters.getPaneDivisions(sheetId);
    const offsetCorrectionX = this.getters.getColDimensions(sheetId, xSplit).start;
    const offsetCorrectionY = this.getters.getRowDimensions(sheetId, ySplit).start;
    const {
      width: svWidth,
      height: svHeight,
      gridOffsetX,
      gridOffsetY,
    } = this.getSheetViewSizes(sheetId, paneId);
    const width = svWidth + gridOffsetX;
    const height = svHeight + gridOffsetY;
    return { xRatio: offsetCorrectionX / width, yRatio: offsetCorrectionY / height };
  }

  mapViewportsToRect(
    sheetId: UID,
    rectCallBack: (viewport: InternalViewport) => Rect | undefined,
    paneId?: string
  ): Rect {
    let x: Pixel = Infinity;
    let y: Pixel = Infinity;
    let width: Pixel = 0;
    let height: Pixel = 0;
    let hasViewports: boolean = false;
    for (const viewport of this.getSubViewports(sheetId, paneId)) {
      const rect = rectCallBack(viewport);
      if (rect) {
        hasViewports = true;
        x = Math.min(x, rect.x);
        y = Math.min(y, rect.y);
        width = Math.max(width, rect.x + rect.width);
        height = Math.max(height, rect.y + rect.height);
      }
    }
    if (!hasViewports) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    return { x, y, width: width - x, height: height - y };
  }
}
