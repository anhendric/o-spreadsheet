import { _t } from "@odoo/o-spreadsheet-engine/translation";
import * as ACTION_DATA from "../actions/data_actions";
import * as ACTION_EDIT from "../actions/edit_actions";
import * as ACTION_FORMAT from "../actions/format_actions";
import * as ACTION_INSERT from "../actions/insert_actions";
import * as ACTION_VIEW from "../actions/view_actions";
import { ActionButton } from "../components/action_button/action_button";
import { BorderEditorWidget } from "../components/border_editor/border_editor_widget";
import { PaintFormatButton } from "../components/paint_format_button/paint_format_button";
import { TableDropdownButton } from "../components/tables/table_dropdown_button/table_dropdown_button";
import { TopBarColorEditor } from "../components/top_bar/color_editor/color_editor";
import { DropdownAction } from "../components/top_bar/dropdown_action/dropdown_action";
import { TopBarFontSizeEditor } from "../components/top_bar/font_size_editor/font_size_editor";
import { NumberFormatsTool } from "../components/top_bar/number_formats_tool/number_formats_tool";
import { ToolBarZoom } from "../components/top_bar/zoom_editor/zoom_editor";
import { ribbonRegistry } from "./ribbon_registry";

ribbonRegistry
  .addTab("home", _t("Home"), 10)
  .addTab("insert", _t("Insert"), 20)
  .addTab("data", _t("Data"), 30)
  .addTab("view", _t("View"), 40);

// --- HOME TAB ---

// Clipboard
ribbonRegistry.addGroup("home", "clipboard", _t("Clipboard"), 5);
ribbonRegistry.addItem("home", "clipboard", {
  id: "paste_special",
  component: DropdownAction,
  props: {
    parentAction: ACTION_EDIT.paste,
    childActions: [ACTION_EDIT.pasteSpecialValue, ACTION_EDIT.pasteSpecialFormat],
    class: "o-hoverable-button o-toolbar-button",
    childClass: "o-hoverable-button",
  },
  sequence: 10,
});
ribbonRegistry.addItem("home", "clipboard", {
  id: "cut",
  component: ActionButton,
  props: {
    action: ACTION_EDIT.cut,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 20,
});
ribbonRegistry.addItem("home", "clipboard", {
  id: "copy",
  component: ActionButton,
  props: {
    action: ACTION_EDIT.copy,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 30,
});
ribbonRegistry.addItem("home", "clipboard", {
  id: "paint_format",
  component: PaintFormatButton,
  props: {
    class: "o-hoverable-button o-toolbar-button o-mobile-disabled",
  },
  sequence: 40,
});

// Undo/Redo
ribbonRegistry.addGroup("home", "undo_redo", _t("Undo / Redo"), 10);
ribbonRegistry.addItem("home", "undo_redo", {
  id: "undo",
  component: ActionButton,
  props: {
    action: ACTION_EDIT.undo,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 10,
});
ribbonRegistry.addItem("home", "undo_redo", {
  id: "redo",
  component: ActionButton,
  props: {
    action: ACTION_EDIT.redo,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 20,
});
ribbonRegistry.addItem("home", "undo_redo", {
  id: "clear_format",
  component: ActionButton,
  props: {
    action: ACTION_FORMAT.clearFormat,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 30,
});

// Styles
ribbonRegistry.addGroup("home", "styles", _t("Styles"), 20);
ribbonRegistry.addItem("home", "styles", {
  id: "font_size",
  component: TopBarFontSizeEditor,
  props: {
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 10,
});
ribbonRegistry.addItem("home", "styles", {
  id: "bold",
  component: ActionButton,
  props: {
    action: ACTION_FORMAT.formatBold,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 20,
});
ribbonRegistry.addItem("home", "styles", {
  id: "italic",
  component: ActionButton,
  props: {
    action: ACTION_FORMAT.formatItalic,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 30,
});
ribbonRegistry.addItem("home", "styles", {
  id: "strikethrough",
  component: ActionButton,
  props: {
    action: ACTION_FORMAT.formatStrikethrough,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 40,
});
ribbonRegistry.addItem("home", "styles", {
  id: "text_color",
  component: TopBarColorEditor,
  props: {
    class: "o-hoverable-button o-menu-item-button o-toolbar-button",
    style: "textColor",
    icon: "o-spreadsheet-Icon.TEXT_COLOR",
    title: _t("Text Color"),
  },
  sequence: 50,
});
ribbonRegistry.addItem("home", "styles", {
  id: "fill_color",
  component: TopBarColorEditor,
  props: {
    class: "o-hoverable-button o-menu-item-button o-toolbar-button",
    style: "fillColor",
    icon: "o-spreadsheet-Icon.FILL_COLOR",
    title: _t("Fill Color"),
  },
  sequence: 60,
});
ribbonRegistry.addItem("home", "styles", {
  id: "borders",
  component: BorderEditorWidget,
  props: {
    class: "o-hoverable-button o-menu-item-button o-toolbar-button",
  },
  sequence: 70,
});
ribbonRegistry.addItem("home", "styles", {
  id: "format_cf",
  component: ActionButton,
  props: {
    action: ACTION_FORMAT.formatCF,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 10,
});

// Alignment
ribbonRegistry.addGroup("home", "alignment", _t("Alignment"), 30);
ribbonRegistry.addItem("home", "alignment", {
  id: "halign",
  component: DropdownAction,
  props: {
    parentAction: ACTION_FORMAT.formatAlignmentHorizontal,
    childActions: [
      ACTION_FORMAT.formatAlignmentLeft,
      ACTION_FORMAT.formatAlignmentCenter,
      ACTION_FORMAT.formatAlignmentRight,
    ],
    class: "o-hoverable-button o-toolbar-button",
    childClass: "o-hoverable-button",
  },
  sequence: 10,
});
ribbonRegistry.addItem("home", "alignment", {
  id: "valign",
  component: DropdownAction,
  props: {
    parentAction: ACTION_FORMAT.formatAlignmentVertical,
    childActions: [
      ACTION_FORMAT.formatAlignmentTop,
      ACTION_FORMAT.formatAlignmentMiddle,
      ACTION_FORMAT.formatAlignmentBottom,
    ],
    class: "o-hoverable-button o-menu-item-button o-toolbar-button",
    childClass: "o-hoverable-button",
  },
  sequence: 20,
});
ribbonRegistry.addItem("home", "alignment", {
  id: "wrap",
  component: DropdownAction,
  props: {
    parentAction: ACTION_FORMAT.formatWrapping,
    childActions: [
      ACTION_FORMAT.formatWrappingOverflow,
      ACTION_FORMAT.formatWrappingWrap,
      ACTION_FORMAT.formatWrappingClip,
    ],
    class: "o-hoverable-button o-menu-item-button o-toolbar-button",
    childClass: "o-hoverable-button",
  },
  sequence: 30,
});
ribbonRegistry.addItem("home", "alignment", {
  id: "rotation",
  component: DropdownAction,
  props: {
    parentAction: ACTION_FORMAT.formatRotation,
    childActions: [
      ACTION_FORMAT.formatNoRotation,
      ACTION_FORMAT.formatRotation45,
      ACTION_FORMAT.formatRotation90,
      ACTION_FORMAT.formatRotation270,
      ACTION_FORMAT.formatRotation315,
    ],
    class: "o-hoverable-button o-menu-item-button o-toolbar-button",
    childClass: "o-hoverable-button",
  },
  sequence: 50,
});

ribbonRegistry.addItem("home", "alignment", {
  id: "merge",
  component: ActionButton,
  props: {
    action: ACTION_EDIT.mergeCells,
    class: "o-hoverable-button o-menu-item-button o-toolbar-button",
  },
  sequence: 60,
});

// Number
ribbonRegistry.addGroup("home", "number", _t("Number"), 40);
ribbonRegistry.addItem("home", "number", {
  id: "percent",
  component: ActionButton,
  props: {
    action: ACTION_FORMAT.formatPercent,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 10,
});
ribbonRegistry.addItem("home", "number", {
  id: "inc_decimal",
  component: ActionButton,
  props: {
    action: ACTION_FORMAT.increaseDecimalPlaces,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 20,
});
ribbonRegistry.addItem("home", "number", {
  id: "dec_decimal",
  component: ActionButton,
  props: {
    action: ACTION_FORMAT.decreaseDecimalPlaces,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 30,
});
ribbonRegistry.addItem("home", "number", {
  id: "format",
  component: NumberFormatsTool,
  props: {
    class: "o-menu-item-button o-hoverable-button o-toolbar-button",
  },
  sequence: 40,
});

// Editing
ribbonRegistry.addGroup("home", "editing", _t("Editing"), 60);
ribbonRegistry.addItem("home", "editing", {
  id: "find_replace",
  component: ActionButton,
  props: {
    action: ACTION_EDIT.findAndReplace,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 10,
});
ribbonRegistry.addItem("home", "editing", {
  id: "table_dropdown",
  component: TableDropdownButton,
  props: {
    class: "o-toolbar-button o-hoverable-button o-menu-item-button o-mobile-disabled",
  },
  sequence: 20,
});

// --- INSERT TAB ---

// Charts
ribbonRegistry.addGroup("insert", "figures", _t("Figures"), 10);
ribbonRegistry.addItem("insert", "figures", {
  id: "insert_chart",
  component: ActionButton,
  props: {
    action: ACTION_INSERT.insertChart,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 10,
});
ribbonRegistry.addItem("insert", "figures", {
  id: "insert_image",
  component: ActionButton,
  props: {
    action: ACTION_INSERT.insertImage,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 20,
});
ribbonRegistry.addItem("insert", "figures", {
  id: "insert_drawing",
  component: ActionButton,
  props: {
    action: {
      name: _t("Drawing"),
      icon: "o-spreadsheet-Icon.DRAWING",
      execute: async (env: any) => {
        const sheetId = env.model.getters.getActiveSheetId();
        const figureId = env.model.uuidGenerator.uuidv4();
        await env.model.dispatch("CREATE_FIGURE", {
          sheetId,
          figureId,
          tag: "drawing",
          col: 0,
          row: 0,
          offset: { x: 100, y: 100 },
          size: { width: 400, height: 300 },
        });
        await env.model.dispatch("CREATE_DRAWING_FIGURE", { figureId });
        env.model.dispatch("SELECT_FIGURE", { figureId });
        env.openSidePanel("DrawingSidePanel", { figureId });
      },
    },
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 30,
});

// Tables
ribbonRegistry.addGroup("insert", "tables", _t("Tables"), 20);
ribbonRegistry.addItem("insert", "tables", {
  id: "insert_pivot",
  component: ActionButton,
  props: {
    action: ACTION_INSERT.insertPivot,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 10,
});
ribbonRegistry.addItem("insert", "tables", {
  id: "insert_table",
  component: ActionButton,
  props: {
    action: ACTION_INSERT.insertTable,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 20,
});

// Cells
ribbonRegistry.addGroup("insert", "cells", _t("Cells"), 30);
ribbonRegistry.addItem("insert", "cells", {
  id: "insert_cell_shortcut",
  component: DropdownAction,
  props: {
    parentAction: ACTION_INSERT.insertCell,
    childActions: [ACTION_INSERT.insertCellShiftDown, ACTION_INSERT.insertCellShiftRight],
    class: "o-hoverable-button o-toolbar-button",
    childClass: "o-hoverable-button",
  },
  sequence: 10,
});
ribbonRegistry.addItem("insert", "cells", {
  id: "insert_row_shortcut",
  component: DropdownAction,
  props: {
    parentAction: ACTION_INSERT.insertRow,
    childActions: [ACTION_INSERT.topBarInsertRowsBefore, ACTION_INSERT.topBarInsertRowsAfter],
    class: "o-hoverable-button o-toolbar-button",
    childClass: "o-hoverable-button",
  },
  sequence: 15,
});
ribbonRegistry.addItem("insert", "cells", {
  id: "insert_col_shortcut",
  component: DropdownAction,
  props: {
    parentAction: ACTION_INSERT.insertCol,
    childActions: [ACTION_INSERT.topBarInsertColsBefore, ACTION_INSERT.topBarInsertColsAfter],
    class: "o-hoverable-button o-toolbar-button",
    childClass: "o-hoverable-button",
  },
  sequence: 20,
});

// Links
ribbonRegistry.addGroup("insert", "links", _t("Links"), 40);
ribbonRegistry.addItem("insert", "links", {
  id: "insert_link",
  component: ActionButton,
  props: {
    action: ACTION_INSERT.insertLink,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 10,
});

// Controls
ribbonRegistry.addGroup("insert", "controls", _t("Controls"), 50);
ribbonRegistry.addItem("insert", "controls", {
  id: "insert_checkbox",
  component: ActionButton,
  props: {
    action: ACTION_INSERT.insertCheckbox,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 10,
});
ribbonRegistry.addItem("insert", "controls", {
  id: "insert_dropdown",
  component: ActionButton,
  props: {
    action: ACTION_INSERT.insertDropdown,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 20,
});

// Symbols (Functions)
ribbonRegistry.addGroup("insert", "symbols", _t("Symbols"), 60);
ribbonRegistry.addItem("insert", "symbols", {
  id: "insert_function_sum",
  component: DropdownAction,
  props: {
    parentAction: ACTION_INSERT.insertFunction,
    childActions: [
      ACTION_INSERT.insertFunctionSum,
      ACTION_INSERT.insertFunctionAverage,
      ACTION_INSERT.insertFunctionCount,
      ACTION_INSERT.insertFunctionMax,
      ACTION_INSERT.insertFunctionMin,
    ],
    class: "o-hoverable-button o-toolbar-button",
    childClass: "o-hoverable-button",
  },
  sequence: 10,
});
ribbonRegistry.addItem("insert", "symbols", {
  id: "insert_equation",
  component: ActionButton,
  props: {
    action: {
      name: _t("Equation"),
      icon: "o-spreadsheet-Icon.EQUATION",
      execute: async (env: any) => {
        const sheetId = env.model.getters.getActiveSheetId();
        const figureId = env.model.uuidGenerator.smallUuid();
        await env.model.dispatch("CREATE_FIGURE", {
          sheetId,
          figureId,
          tag: "latex",
          col: 0,
          row: 0,
          offset: { x: 100, y: 100 },
          size: { width: 200, height: 100 },
        } as any);
        await env.model.dispatch("UPDATE_LATEX_FIGURE", {
          figureId,
          latex: String.raw`\int_{-\infty}^\infty e^{-x^2} dx = \sqrt{\pi}`,
        } as any);
        env.model.dispatch("SELECT_FIGURE", { figureId });
      },
    },
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 20,
});
ribbonRegistry.addItem("insert", "symbols", {
  id: "insert_special_character",
  component: ActionButton,
  props: {
    action: {
      name: _t("Special Character"),
      icon: "o-spreadsheet-Icon.SPECIAL_CHARACTERS",
      execute: (env: any) => env.openSidePanel("InsertSpecialCharacter"),
    },
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 30,
});

// Sheet
ribbonRegistry.addGroup("insert", "sheet", _t("Sheet"), 70);
ribbonRegistry.addItem("insert", "sheet", {
  id: "insert_sheet",
  component: ActionButton,
  props: {
    action: ACTION_INSERT.insertSheet,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 10,
});

// --- DATA TAB ---

// Sort & Filter
ribbonRegistry.addGroup("data", "sort_filter", _t("Sort & Filter"), 10);
ribbonRegistry.addItem("data", "sort_filter", {
  id: "create_filter",
  component: ActionButton,
  props: {
    action: ACTION_DATA.createRemoveFilterTool,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 10,
});
ribbonRegistry.addItem("data", "sort_filter", {
  id: "sort_ascending",
  component: ActionButton,
  props: {
    action: ACTION_DATA.sortAscending,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 20,
});
ribbonRegistry.addItem("data", "sort_filter", {
  id: "sort_descending",
  component: ActionButton,
  props: {
    action: ACTION_DATA.sortDescending,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 30,
});

// Data Tools
ribbonRegistry.addGroup("data", "data_tools", _t("Data Tools"), 20);
ribbonRegistry.addItem("data", "data_tools", {
  id: "remove_duplicates",
  component: ActionButton,
  props: {
    action: ACTION_DATA.removeDuplicates,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 10,
});
ribbonRegistry.addItem("data", "data_tools", {
  id: "split_to_columns",
  component: ActionButton,
  props: {
    action: ACTION_DATA.splitToColumns,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 20,
});
ribbonRegistry.addItem("data", "data_tools", {
  id: "trim_whitespace",
  component: ActionButton,
  props: {
    action: ACTION_DATA.trimWhitespace,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 30,
});

// Forecast / Analysis
ribbonRegistry.addGroup("data", "analysis", _t("Analysis"), 30);
ribbonRegistry.addItem("data", "analysis", {
  id: "what_if_analysis",
  component: DropdownAction,
  props: {
    parentAction: { name: _t("What-If Analysis"), icon: "o-spreadsheet-Icon.WHAT_IF" },
    childActions: [
      {
        name: _t("Goal Seek"),
        execute: (env: any) => env.openSidePanel("GoalSeek"),
        icon: "o-spreadsheet-Icon.GOAL_SEEK",
      },
      {
        name: _t("Scenario Manager"),
        execute: (env: any) => env.openSidePanel("Scenario"),
        icon: "o-spreadsheet-Icon.SCENARIOS",
      },
      {
        name: _t("Data Table"),
        execute: (env: any) => env.openSidePanel("DataTable"),
        icon: "o-spreadsheet-Icon.DATA_TABLE",
      },
    ],
    class: "o-hoverable-button o-toolbar-button",
    childClass: "o-hoverable-button",
  },
  sequence: 10,
});
ribbonRegistry.addItem("data", "analysis", {
  id: "solver",
  component: ActionButton,
  props: {
    action: {
      name: _t("Solver"),
      execute: (env: any) => env.openSidePanel("Solver"),
      icon: "o-spreadsheet-Icon.SOLVER",
    },
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 20,
});

// --- VIEW TAB ---

// Show
ribbonRegistry.addGroup("view", "show", _t("Show"), 10);
ribbonRegistry.addItem("view", "show", {
  id: "view_gridlines",
  component: ActionButton,
  props: {
    action: ACTION_VIEW.viewGridlines,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 10,
});
ribbonRegistry.addItem("view", "show", {
  id: "view_formulas",
  component: ActionButton,
  props: {
    action: ACTION_VIEW.viewFormulas,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 20,
});
ribbonRegistry.addItem("view", "show", {
  id: "irregularity_map",
  component: ActionButton,
  props: {
    action: ACTION_VIEW.irregularityMap,
    class: "o-hoverable-button o-toolbar-button",
  },
  sequence: 30,
});

// Zoom
ribbonRegistry.addGroup("view", "zoom", _t("Zoom"), 20);
ribbonRegistry.addItem("view", "zoom", {
  id: "zoom",
  component: ToolBarZoom,
  props: {
    class: "o-menu-item-button o-hoverable-button o-toolbar-button",
  },
  sequence: 10,
});

// Window
ribbonRegistry.addGroup("view", "window", _t("Window"), 30);
ribbonRegistry.addItem("view", "window", {
  id: "freeze_panes",
  component: DropdownAction,
  props: {
    parentAction: ACTION_VIEW.freezePane,
    childActions: [
      ACTION_VIEW.unFreezePane,
      ACTION_VIEW.freezeFirstRow,
      ACTION_VIEW.freezeSecondRow,
      ACTION_VIEW.freezeCurrentRow,
      ACTION_VIEW.freezeFirstCol,
      ACTION_VIEW.freezeSecondCol,
      ACTION_VIEW.freezeCurrentCol,
    ],
    class: "o-hoverable-button o-toolbar-button",
    childClass: "o-hoverable-button",
  },
  sequence: 10,
});

// Outline
ribbonRegistry.addGroup("view", "outline", _t("Outline"), 40);
ribbonRegistry.addItem("view", "outline", {
  id: "group_headers",
  component: DropdownAction,
  props: {
    parentAction: { name: _t("Group"), icon: "o-spreadsheet-Icon.GROUP_COLUMNS" },
    childActions: [ACTION_VIEW.groupColumns, ACTION_VIEW.groupRows],
    class: "o-hoverable-button o-toolbar-button",
    childClass: "o-hoverable-button",
  },
  sequence: 10,
});
ribbonRegistry.addItem("view", "outline", {
  id: "ungroup_headers",
  component: DropdownAction,
  props: {
    parentAction: { name: _t("Ungroup"), icon: "o-spreadsheet-Icon.UNGROUP_COLUMNS" },
    childActions: [ACTION_VIEW.ungroupColumns, ACTION_VIEW.ungroupRows],
    class: "o-hoverable-button o-toolbar-button",
    childClass: "o-hoverable-button",
  },
  sequence: 20,
});
