import { DEFAULT_FONT_SIZE } from "@odoo/o-spreadsheet-engine/constants";
import { SpreadsheetChildEnv } from "@odoo/o-spreadsheet-engine/types/spreadsheet_env";
import { Component, xml } from "@odoo/owl";
import { Model } from "../src";
import { CellComposerStore } from "../src/components/composer/composer/cell_composer_store";
import { PaintFormatStore } from "../src/components/paint_format_button/paint_format_store";
import { TopBar } from "../src/components/top_bar/top_bar";

import { toZone, zoneToXc } from "../src/helpers";
import { topbarMenuRegistry } from "../src/registries/menus";
import { topbarComponentRegistry } from "../src/registries/topbar_component_registry";
import { ConditionalFormat, Currency, Pixel, Style } from "../src/types";
import { FileStore } from "./__mocks__/mock_file_store";
import { MockTransportService } from "./__mocks__/transport_service";
import {
  addCellToSelection,
  createTableWithFilter,
  freezeColumns,
  freezeRows,
  merge,
  selectCell,
  setAnchorCorner,
  setCellContent,
  setSelection,
  setStyle,
  setZoneBorders,
} from "./test_helpers/commands_helpers";
import {
  click,
  doubleClick,
  getElComputedStyle,
  getTextNodes,
  keyDown,
  simulateClick,
  triggerMouseEvent,
} from "./test_helpers/dom_helper";
import { getBorder, getCell, getStyle, getTable } from "./test_helpers/getters_helpers";
import {
  addToRegistry,
  getFigureIds,
  getInputSelection,
  getNode,
  mountComponent,
  mountSpreadsheet,
  nextTick,
  target,
  toRangesData,
  typeInComposerTopBar,
} from "./test_helpers/helpers";
import { extendMockGetBoundingClientRect } from "./test_helpers/mock_helpers";

jest.mock("../src/helpers/figures/images/image_provider", () =>
  require("./__mocks__/mock_image_provider")
);

const topBarToolsHeight = 30;
let spreadsheetWidth = 1000;
let spreadsheetHeight = 1000;
const moreToolsContainerWidth = 50;
const moreToolsWidth = 50;
const toolWidth = 100;

beforeEach(() => {
  extendMockGetBoundingClientRect({
    "o-spreadsheet": () => ({ x: 0, y: 0, width: spreadsheetWidth, height: spreadsheetHeight }),
    "o-popover": () => ({ width: 50, height: 50 }),
    "o-topbar-responsive": () => ({ x: 0, y: 0, width: spreadsheetWidth, height: 1000 }),
    "o-toolbar-tools": () => ({ x: 0, y: 0, width: spreadsheetWidth, height: topBarToolsHeight }),
    "tool-container": () => ({ x: 0, y: 0, width: toolWidth, height: topBarToolsHeight }),
    "more-tools-container": () => ({
      x: 0,
      y: 0,
      width: moreToolsContainerWidth,
      height: topBarToolsHeight,
    }),
    "more-tools": () => ({
      x: 0,
      y: 0,
      width: moreToolsWidth,
      height: topBarToolsHeight,
    }),
    "o-dropdown": () => ({ x: 0, y: 0, width: 30, height: topBarToolsHeight }),
  });
});

afterEach(() => {
  spreadsheetWidth = 1000;
  spreadsheetHeight = 1000;
});

let fixture: HTMLElement;
let parent: Parent;

class Parent extends Component<any, SpreadsheetChildEnv> {
  static template = xml/* xml */ `
    <div class="o-spreadsheet">
      <TopBar
        onClick="() => {}"
        dropdownMaxHeight="gridHeight"/>
    </div>
  `;
  static components = { TopBar };
  static props = {};

  get gridHeight(): Pixel {
    const { height } = this.env.model.getters.getSheetViewDimension();
    return height;
  }
}

class Comp extends Component {
  static template = xml`<div class="o-topbar-test">Test</div>`;
  static props = {};
}

class Comp1 extends Comp {
  static template = xml`<div class="o-topbar-test1">Test1</div>`;
}
class Comp2 extends Comp {
  static template = xml`<div class="o-topbar-test2">Test2</div>`;
}

async function mountParent(
  model: Model = new Model(),
  testEnv?: Partial<SpreadsheetChildEnv>
): Promise<{ parent: Parent; model: Model; fixture: HTMLElement }> {
  const env = {
    ...testEnv,
    model,
  };
  let parent: Component;
  ({ parent, fixture } = await mountComponent(Parent, { env }));
  return { parent: parent as Parent, model, fixture };
}

describe("TopBar component", () => {
  test("simple rendering", async () => {
    await mountParent();
    expect(fixture.querySelector(".o-spreadsheet-topbar")).toMatchSnapshot();
  });

  test("opening a second menu closes the first one", async () => {
    const model = new Model();
    setCellContent(model, "B2", "b2");
    await mountParent(model);
    expect(fixture.querySelectorAll(".o-dropdown-content").length).toBe(0);
    await nextTick();
    await click(fixture, '.o-menu-item-button[title="Vertical align"]');
    expect(fixture.querySelectorAll(".o-dropdown-content").length).toBe(1);
    expect(fixture.querySelectorAll('.o-menu-item-button[title="Top"]').length).not.toBe(0);
    await click(fixture, '.o-menu-item-button[title="Horizontal align"]');
    expect(fixture.querySelectorAll(".o-dropdown-content").length).toBe(1);
    expect(fixture.querySelectorAll('.o-menu-item-button[title="Top"]').length).toBe(0);
  });

  test("Menu should be closed while clicking on composer", async () => {
    await mountParent();
    expect(fixture.querySelectorAll(".o-menu").length).toBe(0);
    await click(fixture.querySelectorAll(".o-ribbon-tab")[0]);
    expect(fixture.querySelectorAll(".o-menu").length).toBe(1);
    await click(fixture, ".o-spreadsheet-topbar div.o-composer");
    expect(fixture.querySelectorAll(".o-menu").length).toBe(0);
  });

  test("merge button is active when selected zone contains merged cells", async () => {
    const { model } = await mountParent();
    const mergeTool = () => fixture.querySelector('.o-menu-item-button[title="Merge cells"]')!;

    // Case 1: A selected zone contains merged cells → should be active
    merge(model, "A1:B2");
    setSelection(model, ["A1:C3", "D1:F3"]);
    await nextTick();
    expect(mergeTool().classList.contains("active")).toBeTruthy();

    // Case 2: No selected zone contains merged cells → should not be active
    setSelection(model, ["D1:F3", "H1:J3"]);
    await nextTick();
    expect(mergeTool().classList.contains("active")).toBeFalsy();
  });

  test("disables the merge button when selected zones share overlapping cells", async () => {
    const { model } = await mountParent();

    setSelection(model, ["A1:B2", "C1:D2"]);
    await nextTick();

    const mergeTool = fixture.querySelector('.o-menu-item-button[title="Merge cells"]')!;
    expect(mergeTool.classList.contains("o-disabled")).toBeFalsy();

    setSelection(model, ["A1:B2", "B1:C2"]);
    await nextTick();

    expect(mergeTool.classList.contains("o-disabled")).toBeTruthy();
  });

  test("disables the merge button when any one zone crosses a frozen pane", async () => {
    const { model } = await mountParent();

    freezeColumns(model, 2);
    freezeRows(model, 2);

    const mergeTool = fixture.querySelector('.o-menu-item-button[title="Merge cells"]')!;

    setSelection(model, ["B1:C1"]);
    await nextTick();
    expect(mergeTool.classList.contains("o-disabled")).toBeTruthy();

    setSelection(model, ["A2:A3"]);
    await nextTick();
    expect(mergeTool.classList.contains("o-disabled")).toBeTruthy();

    setSelection(model, ["D5:E7", "B1:C1"]);
    await nextTick();
    expect(mergeTool.classList.contains("o-disabled")).toBeTruthy();

    setSelection(model, ["D5:E7", "A2:A3"]);
    await nextTick();
    expect(mergeTool.classList.contains("o-disabled")).toBeTruthy();
  });

  test("allows merging multiple non-overlapping zones", async () => {
    const { model } = await mountParent();
    const sheetId = model.getters.getActiveSheetId();

    setSelection(model, ["A1:B2", "C1:D2"]);
    await nextTick();

    const mergeTool = fixture.querySelector('.o-menu-item-button[title="Merge cells"]')!;
    expect(mergeTool.classList.contains("o-disabled")).toBeFalsy();
    expect(model.getters.getMerges(sheetId)).toEqual([]);

    await click(mergeTool);
    expect(model.getters.getMerges(sheetId)).toEqual([
      { id: 1, top: 0, left: 0, bottom: 1, right: 1 },
      { id: 2, top: 0, left: 2, bottom: 1, right: 3 },
    ]);
  });

  test("toggles merge/unmerge based on selected zones containing merged cells", async () => {
    const { model } = await mountParent();
    const sheetId = model.getters.getActiveSheetId();

    // First select zones without merged cells
    setSelection(model, ["A1:C3", "D1:E2"]);
    await nextTick();

    const mergeTool = fixture.querySelector('.o-menu-item-button[title="Merge cells"]')!;

    expect(mergeTool.classList.contains("active")).toBeFalsy();
    expect(mergeTool.classList.contains("o-disabled")).toBeFalsy();
    expect(model.getters.getMerges(sheetId)).toEqual([]);

    await click(mergeTool);
    expect(model.getters.getMerges(sheetId)).toEqual([
      { id: 1, top: 0, left: 0, bottom: 2, right: 2 },
      { id: 2, top: 0, left: 3, bottom: 1, right: 4 },
    ]);

    // Now select a zone with merged cells
    setSelection(model, ["G1:H2", "A1:C3", "D1:E2"]);
    await nextTick();

    expect(mergeTool.classList.contains("active")).toBeTruthy();

    await click(mergeTool);
    expect(model.getters.getMerges(sheetId)).toEqual([]);

    expect(mergeTool.classList.contains("o-disabled")).toBeFalsy();
  });

  test("undo/redo tools", async () => {
    const { model } = await mountParent();
    const undoTool = fixture.querySelector('.o-menu-item-button[title="Undo (Ctrl+Z)"]')!;
    const redoTool = fixture.querySelector('.o-menu-item-button[title="Redo (Ctrl+Y)"]')!;

    expect(undoTool.classList.contains("o-disabled")).toBeTruthy();
    expect(redoTool.classList.contains("o-disabled")).toBeTruthy();

    setSelection(model, ["A2"]); // non repeatable command
    await nextTick();
    expect(undoTool.classList.contains("o-disabled")).toBeTruthy();
    expect(redoTool.classList.contains("o-disabled")).toBeTruthy();

    setStyle(model, "A1", { bold: true });
    await nextTick();
    expect(undoTool.classList.contains("o-disabled")).toBeFalsy();
    expect(redoTool.classList.contains("o-disabled")).toBeFalsy();
    expect(getCell(model, "A1")!.style).toBeDefined();

    await click(undoTool);
    expect(undoTool.classList.contains("o-disabled")).toBeTruthy();
    expect(redoTool.classList.contains("o-disabled")).toBeFalsy();

    expect(getCell(model, "A1")).toBeUndefined();
  });

  test("irregularity map tool", async () => {
    const { parent } = await mountParent();
    const menu = getNode(["view", "view_irregularity_map"], parent.env, topbarMenuRegistry);
    expect(".irregularity-map").toHaveCount(0);
    menu.execute?.(parent.env);
    await nextTick();
    expect(".irregularity-map").toHaveCount(1);
    await click(fixture, ".irregularity-map");
    expect(".irregularity-map btn").toHaveCount(0);
  });

  describe("Paint format tools", () => {
    test("Single click to activate paint format (once)", async () => {
      const { parent } = await mountParent();
      const paintFormatTool = fixture.querySelector('.o-menu-item-button[title="Paint Format"]')!;
      expect(paintFormatTool.classList.contains("active")).toBeFalsy();

      await click(paintFormatTool);
      expect(paintFormatTool.classList.contains("active")).toBeTruthy();

      parent.env.getStore(PaintFormatStore).pasteFormat(target("B2"));
      await nextTick();
      expect(paintFormatTool.classList.contains("active")).toBeFalsy();
    });

    test("Double click to activate and keep it", async () => {
      const { parent } = await mountParent();
      const paintFormatTool = fixture.querySelector('.o-menu-item-button[title="Paint Format"]')!;
      expect(paintFormatTool.classList.contains("active")).toBeFalsy();

      await doubleClick(paintFormatTool);
      expect(paintFormatTool.classList.contains("active")).toBeTruthy();

      parent.env.getStore(PaintFormatStore).pasteFormat(target("B2"));
      expect(paintFormatTool.classList.contains("active")).toBeTruthy();
    });

    test("When paint format (single) is activated, single click will exit paint format mode", async () => {
      await mountParent();
      const paintFormatTool = fixture.querySelector('.o-menu-item-button[title="Paint Format"]')!;
      await click(paintFormatTool);
      expect(paintFormatTool.classList.contains("active")).toBeTruthy();

      await click(paintFormatTool);
      expect(paintFormatTool.classList.contains("active")).toBeFalsy();
    });

    test("When paint format (persistent) is activated, single click will exit paint format mode", async () => {
      await mountParent();
      const paintFormatTool = fixture.querySelector('.o-menu-item-button[title="Paint Format"]')!;
      await doubleClick(paintFormatTool);
      expect(paintFormatTool.classList.contains("active")).toBeTruthy();

      await click(paintFormatTool);
      expect(paintFormatTool.classList.contains("active")).toBeFalsy();
    });
  });

  describe("Filter Tool", () => {
    let model: Model;
    const createFilterTool = '[title="Add filters"]';
    const removeFilterTool = '[title="Remove selected filters"]';

    beforeEach(async () => {
      ({ model } = await mountParent());
      const dataTab = Array.from(fixture.querySelectorAll<HTMLElement>(".o-ribbon-tab")).find(
        (el) => el.textContent === "Data"
      )!;
      await simulateClick(dataTab);
      await nextTick();
    });

    test("Filter tool is enabled with single selection", async () => {
      setSelection(model, ["A2:B3"]);
      await nextTick();
      const filterTool = fixture.querySelector(createFilterTool)!;
      expect(filterTool.classList.contains("o-disabled")).toBeFalsy();
    });

    test("Filter tool is enabled with selection of multiple continuous zones", async () => {
      setSelection(model, ["A1", "A2"]);
      await nextTick();
      const filterTool = fixture.querySelector(createFilterTool)!;
      expect(filterTool.classList.contains("o-disabled")).toBeFalsy();
    });

    test("Filter tool is disabled with selection of multiple non-continuous zones", async () => {
      setSelection(model, ["A1", "B5"]);
      await nextTick();
      const filterTool = fixture.querySelector(createFilterTool)!;
      expect(filterTool.classList.contains("o-disabled")).toBeTruthy();
    });

    test("Filter tool change from create filter to remove filter when a filter is selected", async () => {
      createTableWithFilter(model, "A2:B3");
      await nextTick();
      expect(fixture.querySelectorAll(removeFilterTool).length).toEqual(0);
      expect(fixture.querySelectorAll(createFilterTool).length).toEqual(1);

      setSelection(model, ["A1", "B2"]);
      await nextTick();
      expect(fixture.querySelectorAll(removeFilterTool).length).toEqual(1);
      expect(fixture.querySelectorAll(createFilterTool).length).toEqual(0);
    });

    test("Adjacent cells selection while creating table on single cell", async () => {
      setCellContent(model, "A1", "A");
      setCellContent(model, "A2", "A3");
      setCellContent(model, "B2", "B");
      setCellContent(model, "B3", "3");
      setCellContent(model, "C3", "B4");
      setCellContent(model, "C4", "Hello");
      setCellContent(model, "D4", "2");
      selectCell(model, "A1");
      await simulateClick(createFilterTool);
      await nextTick();
      const selection = model.getters.getSelectedZone();
      expect(zoneToXc(selection)).toEqual("A1:D4");
      expect(getTable(model, "A1")!.range.zone).toEqual(toZone("A1:D4"));
    });
  });

  test("can clear formatting", async () => {
    const model = new Model();
    selectCell(model, "B1");
    setZoneBorders(model, { position: "all" });
    expect(getBorder(model, "B1")).toBeDefined();
    await mountParent(model);
    const clearFormatTool = fixture.querySelector(
      '.o-menu-item-button[title="Clear formatting (Ctrl+<)"]'
    )!;
    await click(clearFormatTool);
    expect(getCell(model, "B1")).toBeUndefined();
  });

  test("can set cell format", async () => {
    const { model } = await mountParent();
    expect(getCell(model, "A1")).toBeUndefined();
    const formatTool = fixture.querySelector('.o-menu-item-button[title="More formats"]')!;
    await click(formatTool);
    await click(fixture, `.o-menu-item[title="Percent"]`);
    expect(getCell(model, "A1")!.format).toEqual("0.00%");
  });

  test("can set font size", async () => {
    const { model } = await mountParent();
    const fontSizeText = fixture.querySelector(".o-font-size") as HTMLInputElement;
    expect(fontSizeText.value.trim()).toBe(DEFAULT_FONT_SIZE.toString());
    await click(fontSizeText.parentElement!);
    // ensure the input is no longer selected (not automaticly done by click in jsdom)
    fontSizeText.blur();
    await click(fixture, '.o-text-options [data-size="8"]');
    expect(fontSizeText.value.trim()).toBe("8");
    expect(getStyle(model, "A1").fontSize).toBe(8);
  });

  test("Tab from font size editor closes the dropdown and moves focus to grid", async () => {
    const { fixture } = await mountSpreadsheet();
    const input = fixture.querySelector("input.o-font-size") as HTMLInputElement;
    input.focus();
    await nextTick();
    expect(fixture.querySelector(".o-popover .o-text-options")).toBeTruthy();
    await keyDown({ key: "Tab" });
    expect(fixture.querySelector(".o-popover .o-text-options")).toBeFalsy();
    const composerEl = fixture.querySelector<HTMLElement>(".o-grid-composer .o-composer")!;
    expect(document.activeElement).toBe(composerEl);
  });

  test("Clicking the number editor dropdown arrow focuses the input", async () => {
    const { fixture } = await mountSpreadsheet();
    const input = fixture.querySelector("input.o-font-size") as HTMLInputElement;
    const icon = fixture.querySelectorAll(".o-number-editor .o-icon")[0] as HTMLElement;
    await click(icon);
    expect(document.activeElement).toBe(input);
  });

  test("prevents default behavior of mouse wheel event on font size input", async () => {
    await mountParent();
    const fontSizeInput = fixture.querySelector("input.o-font-size") as HTMLInputElement;

    const event = new WheelEvent("wheel", { deltaY: 100 });
    const preventDefaultSpy = jest.spyOn(event, "preventDefault");

    fontSizeInput.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  describe("horizontal align", () => {
    test.each([
      ["Left (Ctrl+Shift+L)", { align: "left" }],
      ["Center (Ctrl+Shift+E)", { align: "center" }],
      ["Right (Ctrl+Shift+R)", { align: "right" }],
    ])("can set horizontal alignment '%s' with the toolbar", async (iconTitle, expectedStyle) => {
      const { model } = await mountParent();
      await click(fixture, '.o-menu-item-button[title="Horizontal align"]');
      await click(fixture, `.o-menu-item-button[title="${iconTitle}"]`);
      expect(model.getters.getCurrentStyle()).toEqual(expectedStyle);
    });
    test.each([
      ["text", {}, "Left (Ctrl+Shift+L)"],
      ["0", {}, "Right (Ctrl+Shift+R)"],
      ["0", { align: "left" }, "Left (Ctrl+Shift+L)"],
      ["0", { align: "center" }, "Center (Ctrl+Shift+E)"],
      ["0", { align: "right" }, "Right (Ctrl+Shift+R)"],
    ])(
      "alignment icon options in top bar matches the selected cell (content: %s, style: %s)",
      async (content, style, expectedTitleActive) => {
        const model = new Model();
        setCellContent(model, "A1", content);
        setStyle(model, "A1", style as Style);
        await mountParent(model);
        await click(fixture, '.o-menu-item-button[title="Horizontal align"]');
        const expectedButtonActive = fixture.querySelector(
          `.o-menu-item-button[title="${expectedTitleActive}"]`
        )!;
        expect(expectedButtonActive!.classList).toContain("active");
      }
    );
  });

  describe("vertical align", () => {
    test.each([
      ["Top", { verticalAlign: "top" }],
      ["Middle", { verticalAlign: "middle" }],
      ["Bottom", { verticalAlign: "bottom" }],
    ])("can set vertical alignmen '%s't with the toolbar", async (iconTitle, expectedStyle) => {
      const { model } = await mountParent();
      await click(fixture, '.o-menu-item-button[title="Vertical align"]');
      await click(fixture, `.o-menu-item-button[title="${iconTitle}"]`);
      expect(model.getters.getCurrentStyle()).toEqual(expectedStyle);
    });
    test.each([
      ["text", {}, "Bottom"],
      ["0", {}, "Bottom"],
      ["0", { verticalAlign: "top" }, "Top"],
      ["0", { verticalAlign: "middle" }, "Middle"],
      ["0", { verticalAlign: "bottom" }, "Bottom"],
    ])(
      "alignment icon options in top bar matches the selected cell (content: %s, style: %s)",
      async (content, style, expectedTitleActive) => {
        const model = new Model();
        setCellContent(model, "A1", content);
        setStyle(model, "A1", style as Style);
        await mountParent(model);
        await click(fixture, '.o-menu-item-button[title="Vertical align"]');
        const expectedButtonActive = fixture.querySelector(
          `.o-menu-item-button[title="${expectedTitleActive}"]`
        )!;
        expect(expectedButtonActive!.classList).toContain("active");
      }
    );
  });

  describe("text wrapping", () => {
    test.each([
      ["Overflow", { wrapping: "overflow" }],
      ["Wrap", { wrapping: "wrap" }],
      ["Clip", { wrapping: "clip" }],
    ])("can set the wrapping state '%s' with the toolbar", async (iconTitle, expectedStyle) => {
      const { model } = await mountParent();
      await click(fixture, '.o-menu-item-button[title="Wrapping"]');
      await click(fixture, `.o-menu-item-button[title="${iconTitle}"]`);
      expect(model.getters.getCurrentStyle()).toEqual(expectedStyle);
    });
    test.each([
      ["text", {}, "Overflow"],
      ["0", {}, "Overflow"],
      ["0", { wrapping: "overflow" }, "Overflow"],
      ["0", { wrapping: "wrap" }, "Wrap"],
      ["0", { wrapping: "clip" }, "Clip"],
    ])(
      "wrapping icon options in the top bar matches the selected cell (content: %s, style: %s)",
      async (content, style, expectedTitleActive) => {
        const model = new Model();
        setCellContent(model, "A1", content);
        setStyle(model, "A1", style as Style);
        await mountParent(model);
        await click(fixture, '.o-menu-item-button[title="Wrapping"]');
        const expectedButtonActive = fixture.querySelector(
          `.o-menu-item-button[title="${expectedTitleActive}"]`
        );
        expect(expectedButtonActive!.classList).toContain("active");
      }
    );
  });

  test("opening, then closing same menu", async () => {
    const model = new Model();
    setCellContent(model, "B2", "b2");
    await mountParent(model);

    expect(fixture.querySelectorAll(".o-dropdown-content").length).toBe(0);
    await click(fixture, '.o-menu-item-button[title="Vertical align"]');
    expect(fixture.querySelectorAll(".o-dropdown-content").length).toBe(1);
    await click(fixture, '.o-menu-item-button[title="Vertical align"]');
    expect(fixture.querySelectorAll(".o-dropdown-content").length).toBe(0);
  });

  test("Can open the File menu", async () => {
    const { parent } = await mountParent();
    expect(fixture.querySelectorAll(".o-menu")).toHaveLength(0);
    const env = parent.env;
    await click(fixture.querySelectorAll(".o-ribbon-tab")[0]);
    expect(fixture.querySelectorAll(".o-menu")).toHaveLength(1);
    const file = getNode(["file"], env, topbarMenuRegistry);
    const numberChild = file.children(parent.env).filter((item) => item.isVisible(env)).length;
    expect(fixture.querySelectorAll(".o-menu-item")).toHaveLength(numberChild);
    await click(fixture, ".o-spreadsheet-topbar");
    expect(fixture.querySelectorAll(".o-menu")).toHaveLength(0);
  });

  test("Can add a custom component to topbar", async () => {
    const compDefinitions = Object.assign({}, topbarComponentRegistry.content);
    addToRegistry(topbarComponentRegistry, "1", { component: Comp, sequence: 1 });
    await mountParent();
    expect(fixture.querySelectorAll(".o-topbar-test")).toHaveLength(1);
    topbarComponentRegistry.content = compDefinitions;
  });

  test("Can add multiple components to topbar with different visibilities", async () => {
    const compDefinitions = Object.assign({}, topbarComponentRegistry.content);
    let comp1Visibility = false;
    addToRegistry(topbarComponentRegistry, "first", {
      component: Comp1,
      isVisible: () => {
        return comp1Visibility;
      },
      sequence: 1,
    });
    addToRegistry(topbarComponentRegistry, "second", { component: Comp2, sequence: 2 });
    const { parent } = await mountParent();
    expect(fixture.querySelectorAll(".o-topbar-test1")).toHaveLength(0);
    expect(fixture.querySelectorAll(".o-topbar-test2")).toHaveLength(1);

    comp1Visibility = true;
    parent.render();
    await nextTick();
    expect(fixture.querySelectorAll(".o-topbar-test1")).toHaveLength(1);
    expect(fixture.querySelectorAll(".o-topbar-test2")).toHaveLength(1);

    // reset Top Component Registry
    topbarComponentRegistry.content = compDefinitions;
  });

  test("Cannot edit cell in a readonly spreadsheet", async () => {
    const model = new Model({}, { mode: "readonly" });
    ({ fixture, parent } = await mountParent(model));
    const composerStore = parent.env.getStore(CellComposerStore);

    const composerEl = fixture.querySelector(".o-spreadsheet-topbar div.o-composer")!;
    expect(composerEl.attributes.getNamedItem("contentEditable")!.value).toBe("false");
    await simulateClick(composerEl);

    // Won't update the current content
    const content = composerStore.currentContent;
    expect(content).toBe("");
    await typeInComposerTopBar("tabouret", false);
    expect(composerStore.currentContent).toBe(content);
  });

  test("Keep focus on the composer when clicked in readonly mode", async () => {
    ({ fixture } = await mountParent(new Model({}, { mode: "readonly" })));

    const topBarComposerEl = fixture.querySelector<HTMLElement>(".o-topbar-composer")!;
    expect(topBarComposerEl.classList).toContain("o-topbar-composer-readonly");
    const composerEl = fixture.querySelector<HTMLElement>(".o-spreadsheet-topbar div.o-composer")!;
    expect(document.activeElement).not.toBe(composerEl);
    await simulateClick(composerEl);
    expect(document.activeElement).toBe(composerEl);
  });

  test.each([
    ["Horizontal align", ".o-dropdown-content"],
    ["Vertical align", ".o-dropdown-content"],
    ["Wrapping", ".o-dropdown-content"],
    ["Font Size", ".o-text-options"],
    ["More formats", ".o-menu"],
  ])(
    "Clicking a static element inside a dropdown '%s' don't close the dropdown",
    async (toolName: string, dropdownContentSelector: string) => {
      ({ fixture } = await mountParent());
      await click(fixture, `[title="${toolName}"]`);
      expect(fixture.querySelector(dropdownContentSelector)).toBeTruthy();
      await simulateClick(dropdownContentSelector);
      await nextTick();
      expect(fixture.querySelector(dropdownContentSelector)).toBeTruthy();
    }
  );

  test.each([["Fill Color", "Text Color"]])(
    "Clicking a static element inside the color picker *%s* dont close the color picker dropdown",
    async (toolName: string) => {
      await mountParent();

      await simulateClick(`.o-menu-item-button[title="${toolName}"]`);
      await nextTick();
      expect(fixture.querySelector(".o-color-picker")).toBeTruthy();
      await simulateClick(".o-color-picker");
      await nextTick();
      expect(fixture.querySelector(".o-color-picker")).toBeTruthy();
    }
  );

  test("can insert an image", async () => {
    const fileStore = new FileStore();
    const model = new Model({}, { external: { fileStore } });
    await mountParent(model);
    const sheetId = model.getters.getActiveSheetId();
    const insertTab = Array.from(fixture.querySelectorAll<HTMLElement>(".o-ribbon-tab")).find(
      (el) => el.textContent === "Insert"
    )!;
    await simulateClick(insertTab);
    await nextTick();
    await simulateClick(fixture.querySelector(".o-toolbar-button[title='Image (Ctrl+O)']")!);
    expect(getFigureIds(model, sheetId)).toHaveLength(1);
  });

  test("top bar composer displays formula", async () => {
    const { model } = await mountParent();
    const topbarComposerElement = fixture.querySelector(
      ".o-spreadsheet-topbar .o-composer-container div"
    )!;
    setCellContent(model, "A1", "=A1+A2");
    await nextTick();
    expect(topbarComposerElement.textContent).toBe("=A1+A2");
  });
});

test("Can show/hide a TopBarComponent based on condition", async () => {
  const compDefinitions = Object.assign({}, topbarComponentRegistry.content);
  addToRegistry(topbarComponentRegistry, "1", {
    component: Comp1,
    isVisible: (env) => true,
    sequence: 1,
  });
  addToRegistry(topbarComponentRegistry, "2", {
    component: Comp2,
    isVisible: (env) => false,
    sequence: 2,
  });
  await mountParent();
  expect(fixture.querySelectorAll(".o-topbar-test1")).toHaveLength(1);
  expect(fixture.querySelectorAll(".o-topbar-test2")).toHaveLength(0);
  topbarComponentRegistry.content = compDefinitions;
});

describe("TopBar - Custom currency", () => {
  test("can open custom currency sidepanel from tool", async () => {
    const { fixture } = await mountSpreadsheet({
      model: new Model({}, { external: { loadCurrencies: async () => [] as Currency[] } }),
    });
    await click(fixture, ".o-menu-item-button[title='More formats']");
    await click(fixture, ".o-menu-item[title='Custom currency']");
    expect(fixture.querySelector(".o-sidePanel .o-more-formats-panel")).toBeTruthy();
  });
});

describe("Format", () => {
  test("can clear format", async () => {
    const { model, fixture } = await mountSpreadsheet();
    setStyle(model, "A1, B2:B3", { fillColor: "#000000" });
    selectCell(model, "A1");
    addCellToSelection(model, "B2");
    setAnchorCorner(model, "B3");
    expect(getCell(model, "A1")?.style).toEqual({ fillColor: "#000000" });
    expect(getCell(model, "B2")?.style).toEqual({ fillColor: "#000000" });
    expect(getCell(model, "B3")?.style).toEqual({ fillColor: "#000000" });
    await click(fixture, ".o-toolbar-button[title='Clear formatting (Ctrl+<)']");
    expect(getCell(model, "A1")?.style).toBeUndefined();
    expect(getCell(model, "B2")?.style).toBeUndefined();
    expect(getCell(model, "B3")?.style).toBeUndefined();
  });
});

describe("TopBar - CF", () => {
  test("open sidepanel with no CF in selected zone", async () => {
    const { fixture } = await mountSpreadsheet();
    await click(fixture, ".o-toolbar-button[title='Conditional formatting']");
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-cf-preview-list")).toBeTruthy();
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-cf-editor")).toBeFalsy();
  });

  test("open sidepanel with one CF in selected zone", async () => {
    const { model, fixture } = await mountSpreadsheet();

    const cfRule: ConditionalFormat = {
      ranges: ["A1:C7"],
      id: "1",
      rule: {
        values: ["2"],
        operator: "isEqual",
        type: "CellIsRule",
        style: { fillColor: "#FF0000" },
      },
    };
    const sheetId = model.getters.getActiveSheetId();
    model.dispatch("ADD_CONDITIONAL_FORMAT", {
      cf: cfRule,
      sheetId,
      ranges: toRangesData(sheetId, cfRule.ranges.join(",")),
    });
    setSelection(model, ["A1:K11"]);

    await click(fixture, ".o-toolbar-button[title='Conditional formatting']");
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-cf-preview-list")).toBeFalsy();
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-cf-editor")).toBeTruthy();
  });

  test("open sidepanel with with more then one CF in selected zone", async () => {
    const { model, fixture } = await mountSpreadsheet();

    const cfRule1: ConditionalFormat = {
      ranges: ["A1:C7"],
      id: "1",
      rule: {
        values: ["2"],
        operator: "isEqual",
        type: "CellIsRule",
        style: { fillColor: "#FF0000" },
      },
    };
    const cfRule2: ConditionalFormat = {
      ranges: ["A1:C7"],
      id: "2",
      rule: {
        values: ["3"],
        operator: "isEqual",
        type: "CellIsRule",
        style: { fillColor: "#FE0001" },
      },
    };
    const sheetId = model.getters.getActiveSheetId();
    model.dispatch("ADD_CONDITIONAL_FORMAT", {
      cf: cfRule1,
      sheetId,
      ranges: toRangesData(sheetId, cfRule1.ranges.join(",")),
    });
    model.dispatch("ADD_CONDITIONAL_FORMAT", {
      cf: cfRule2,
      sheetId,
      ranges: toRangesData(sheetId, cfRule2.ranges.join(",")),
    });
    setSelection(model, ["A1:K11"]);

    await click(fixture, ".o-toolbar-button[title='Conditional formatting']");
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-cf-preview-list")).toBeTruthy();
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-cf-editor")).toBeFalsy();
  });

  test("will update sidepanel if we reopen it from other cell", async () => {
    const { model, fixture } = await mountSpreadsheet();

    const cfRule1: ConditionalFormat = {
      ranges: ["A1:A10"],
      id: "1",
      rule: {
        values: ["2"],
        operator: "isEqual",
        type: "CellIsRule",
        style: { fillColor: "#FF1200" },
      },
    };
    const sheetId = model.getters.getActiveSheetId();
    model.dispatch("ADD_CONDITIONAL_FORMAT", {
      cf: cfRule1,
      sheetId,
      ranges: toRangesData(sheetId, cfRule1.ranges.join(",")),
    });
    model.dispatch("ADD_CONDITIONAL_FORMAT", {
      cf: { ...cfRule1, id: "2" },
      sheetId,
      ranges: toRangesData(sheetId, "F1"),
    });
    setSelection(model, ["A1:A11"]);
    await click(fixture, ".o-toolbar-button[title='Conditional formatting']");
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-cf-preview-list")).toBeFalsy();
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-cf-editor")).toBeTruthy();

    setSelection(model, ["A1:F1"]);
    await click(fixture, ".o-toolbar-button[title='Conditional formatting']");
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-cf-preview-list")).toBeTruthy();
    expect(fixture.querySelector(".o-sidePanel .o-sidePanelBody .o-cf-editor")).toBeFalsy();
  });
});

test("onCancel of dropdown dv editor removes the data validation rule", async () => {
  const { fixture } = await mountSpreadsheet();
  const insertTab = Array.from(fixture.querySelectorAll<HTMLElement>(".o-ribbon-tab")).find(
    (el) => el.textContent === "Insert"
  )!;
  await simulateClick(insertTab);
  await nextTick();
  await simulateClick(fixture.querySelector(".o-toolbar-button[title='Dropdown list']")!);
  expect(fixture.querySelector(".o-sidePanel .o-dv-form")).toBeTruthy();

  await click(fixture, ".o-sidePanel .o-dv-cancel");
  expect(fixture.querySelector(".o-dv")).toBeTruthy();
  expect(fixture.querySelectorAll(".o-dv-preview")).toHaveLength(0);
});

describe("Topbar - menu item resizing with viewport", () => {
  test("color picker of fill color in top bar is resized with screen size change", async () => {
    const { model, fixture } = await mountParent();
    await click(fixture, '.o-menu-item-button[title="Fill Color"]');
    let height = getElComputedStyle(".o-popover", "maxHeight");
    expect(parseInt(height)).toBe(
      model.getters.getVisibleRect(model.getters.getActiveMainViewport()).height
    );
    model.dispatch("RESIZE_SHEETVIEW", { width: 300, height: 100 });
    spreadsheetHeight = 100;
    window.resizers.resize();
    await nextTick();
    height = getElComputedStyle(".o-popover", "maxHeight");
    expect(parseInt(height)).toBe(
      model.getters.getVisibleRect(model.getters.getActiveMainViewport()).height
    );
  });

  test("color picker of text color in top bar is resized with screen size change", async () => {
    const { model, fixture } = await mountParent();
    await click(fixture, '.o-menu-item-button[title="Text Color"]');
    let height = getElComputedStyle(".o-popover", "maxHeight");
    expect(parseInt(height)).toBe(
      model.getters.getVisibleRect(model.getters.getActiveMainViewport()).height
    );
    model.dispatch("RESIZE_SHEETVIEW", { width: 300, height: 100 });
    spreadsheetHeight = 100;
    window.resizers.resize();
    await nextTick();
    height = getElComputedStyle(".o-popover", "maxHeight");
    expect(parseInt(height)).toBe(
      model.getters.getVisibleRect(model.getters.getActiveMainViewport()).height
    );
  });
});

test("The composer helper should be closed on toggle topbar context menu", async () => {
  const { parent, fixture } = await mountSpreadsheet();
  const composerStore = parent.env.getStore(CellComposerStore);
  await typeInComposerTopBar("=sum(");
  expect(composerStore.editionMode).not.toBe("inactive");
  expect(fixture.querySelectorAll(".o-composer-assistant")).toHaveLength(1);
  await simulateClick(".o-ribbon-tab");
  expect(composerStore.editionMode).toBe("inactive");
  expect(fixture.querySelectorAll(".o-composer-assistant")).toHaveLength(0);
});

test("prettified formula should have the cursor", async () => {
  const { model } = await mountSpreadsheet();

  // I'll set the cursor in between the fours
  const firstPart = "=SUM(11111111, 22222222, 33333333, 4444";
  const secondPart = "4444, 55555555, 66666666, 77777777, 88888888)";
  setCellContent(model, "A1", firstPart + secondPart);
  await nextTick();
  const composerEl: HTMLElement = document.querySelector(".o-spreadsheet-topbar .o-composer")!;
  composerEl.focus();
  triggerMouseEvent(composerEl, "pointerdown");
  const selection = document.getSelection()!;
  const range = document.createRange();
  selection.removeAllRanges();
  selection.addRange(range);
  const textNode = getTextNodes(composerEl)[0];
  range.setStart(textNode, firstPart.length);
  range.setEnd(textNode, firstPart.length);

  await nextTick();
  triggerMouseEvent(composerEl, "pointerup");
  await nextTick();
  triggerMouseEvent(composerEl, "click");
  await nextTick();
  expect(getInputSelection().anchorNodeText).toBe("44444444");
  expect(getInputSelection().anchorOffset).toBe(4);
});

describe("Topbar svg icon", () => {
  test.each([
    [{ align: "left" }, "Horizontal align", "align-left"],
    [{ align: "center" }, "Horizontal align", "align-center"],
    [{ align: "right" }, "Horizontal align", "align-right"],
    [{ verticalAlign: "top" }, "Vertical align", "align-top"],
    [{ verticalAlign: "middle" }, "Vertical align", "align-middle"],
    [{ verticalAlign: "bottom" }, "Vertical align", "align-bottom"],
    [{ wrapping: "clip" }, "Wrapping", "wrapping-clip"],
    [{ wrapping: "wrap" }, "Wrapping", "wrapping-wrap"],
    [{ wrapping: "overflow" }, "Wrapping", "wrapping-overflow"],
  ])("Icon in top bar matches the selected cell style", async (style, buttonTitle, iconClass) => {
    const model = new Model();
    setStyle(model, "A1", style as Style);

    ({ fixture } = await mountSpreadsheet({ model }));

    const icon = fixture.querySelector(`.o-menu-item-button[title="${buttonTitle}"] svg`);
    expect(icon?.classList.contains(iconClass)).toBeTruthy();
  });
});

test("Clicking on a topbar button triggers two renders", async () => {
  const transportService = new MockTransportService();

  const model = new Model({}, { transportService });
  const { fixture, env } = await mountSpreadsheet({ model });

  const modelRender = jest.fn();
  const storeRender = jest.fn();
  model.on("update", {}, modelRender);
  env["__spreadsheet_stores__"].on("store-updated", null, storeRender);

  await click(fixture, ".o-spreadsheet-topbar [title='Bold (Ctrl+B)']");

  // two renders from the model (one from the command handling and one from the collaborative session)
  expect(modelRender).toHaveBeenCalledTimes(2);
  expect(storeRender).toHaveBeenCalledTimes(0);
});
