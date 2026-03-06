import { SplitViewStore } from "../src/components/spreadsheet/split_view_store";
import { mountSpreadsheet, nextTick } from "./test_helpers/helpers";

describe("Split view component tests", () => {
  test("Split view toggles two panes", async () => {
    const { model, env, fixture } = await mountSpreadsheet();
    // Verify one pane initially
    expect(fixture.querySelectorAll(".o-spreadsheet-pane")).toHaveLength(1);

    model.dispatch("CREATE_SHEET", { sheetId: "sheet2", name: "Sheet2", position: 1 });
    const sheetId2 = "sheet2";

    const splitViewStore = env.getStore(SplitViewStore);
    splitViewStore.toggleSplitView(sheetId2);

    await nextTick();

    // Verify two panes are now rendered
    expect(fixture.querySelectorAll(".o-spreadsheet-pane")).toHaveLength(2);

    splitViewStore.toggleSplitView(sheetId2);

    await nextTick();

    // Verify back to one pane
    expect(fixture.querySelectorAll(".o-spreadsheet-pane")).toHaveLength(1);
  });

  test("Independent scrolling in split view", async () => {
    const { model, env } = await mountSpreadsheet();
    model.dispatch("CREATE_SHEET", { sheetId: "sheet2", name: "Sheet2", position: 1 });
    const sheetId1 = model.getters.getActiveSheetId();
    const sheetId2 = "sheet2";

    const splitViewStore = env.getStore(SplitViewStore);
    splitViewStore.toggleSplitView(sheetId2);
    await nextTick();

    // Scroll left pane (sheetId1, paneId 'left')
    model.dispatch("SET_VIEWPORT_OFFSET", {
      offsetX: 100,
      offsetY: 200,
      sheetId: sheetId1,
      paneId: "left",
    });

    expect(model.getters.getActiveSheetScrollInfo(sheetId1, "left")).toEqual({
      scrollX: 100,
      scrollY: 200,
    });
    expect(model.getters.getActiveSheetScrollInfo(sheetId2, "right")).toEqual({
      scrollX: 0,
      scrollY: 0,
    });

    // Scroll right pane (sheetId2, paneId 'right')
    model.dispatch("SET_VIEWPORT_OFFSET", {
      offsetX: 50,
      offsetY: 60,
      sheetId: sheetId2,
      paneId: "right",
    });

    expect(model.getters.getActiveSheetScrollInfo(sheetId2, "right")).toEqual({
      scrollX: 50,
      scrollY: 60,
    });
    expect(model.getters.getActiveSheetScrollInfo(sheetId1, "left")).toEqual({
      scrollX: 100,
      scrollY: 200,
    });

    // Test that switching sheet in one pane maintains scroll for that sheet in that pane
    model.dispatch("ACTIVATE_SHEET", { sheetIdFrom: sheetId1, sheetIdTo: sheetId2 });
    // Note: ACTIVATE_SHEET is global, so it activates sheetId2.
    // However, the left pane should now display its scroll state for sheetId2 (which is 0 initially)
    expect(model.getters.getActiveSheetScrollInfo(sheetId2, "left")).toEqual({
      scrollX: 0,
      scrollY: 0,
    });
    // sheetId2 in right pane should still have 50, 60
    expect(model.getters.getActiveSheetScrollInfo(sheetId2, "right")).toEqual({
      scrollX: 50,
      scrollY: 60,
    });
  });

  test("Clicking a cell in the already-focused pane does not reset its scroll", async () => {
    const { model, env, fixture } = await mountSpreadsheet();
    const sheetId1 = model.getters.getActiveSheetId();

    const splitViewStore = env.getStore(SplitViewStore);
    splitViewStore.toggleSplitView(sheetId1);
    await nextTick();

    // Switch focus to the right pane
    const panes = fixture.querySelectorAll(".o-spreadsheet-pane");
    (panes[1] as HTMLElement).click();
    await nextTick();

    // Scroll the now-focused right pane
    const rightScroll = 460;
    model.dispatch("SET_VIEWPORT_OFFSET", { offsetX: 0, offsetY: rightScroll });
    expect(model.getters.getActiveSheetScrollInfo(sheetId1).scrollY).toBe(rightScroll);

    // Click AGAIN on the right pane (e.g., a cell click) — must NOT reset the scroll
    (panes[1] as HTMLElement).click();
    await nextTick();

    expect(model.getters.getActiveSheetScrollInfo(sheetId1).scrollY).toBe(rightScroll);
  });

  test("Switching focus between panes preserves each pane's scroll position", async () => {
    const { model, env, fixture } = await mountSpreadsheet();
    const sheetId1 = model.getters.getActiveSheetId();

    const splitViewStore = env.getStore(SplitViewStore);
    splitViewStore.toggleSplitView(sheetId1); // same sheet in both panes
    await nextTick();

    // Left pane is focused → it reads/writes the global viewport.
    // Set the global (left-pane) scroll to row ≈10.
    const leftScroll = 230; // 10 rows × 23px
    model.dispatch("SET_VIEWPORT_OFFSET", { offsetX: 0, offsetY: leftScroll });
    expect(model.getters.getActiveSheetScrollInfo(sheetId1).scrollY).toBe(leftScroll);

    // Scroll the inactive right pane independently to row ≈20.
    const rightScroll = 460; // 20 rows × 23px
    model.dispatch("SET_VIEWPORT_OFFSET", {
      offsetX: 0,
      offsetY: rightScroll,
      sheetId: sheetId1,
      paneId: "right",
    });

    // Click the right pane to switch focus to it.
    const panes = fixture.querySelectorAll(".o-spreadsheet-pane");
    (panes[1] as HTMLElement).click();
    await nextTick();

    // After switching focus to the right pane:
    // - the global viewport (now used by focused right pane) should be at rightScroll
    expect(model.getters.getActiveSheetScrollInfo(sheetId1).scrollY).toBe(rightScroll);
    // - the left pane's per-pane viewport should remember leftScroll
    expect(model.getters.getActiveSheetScrollInfo(sheetId1, "left").scrollY).toBe(leftScroll);
  });

  test("Switching focus back restores original scroll positions", async () => {
    const { model, env, fixture } = await mountSpreadsheet();
    model.dispatch("CREATE_SHEET", { sheetId: "sheet2", name: "Sheet2", position: 1 });
    const sheetId1 = model.getters.getActiveSheetId();
    const sheetId2 = "sheet2";

    const splitViewStore = env.getStore(SplitViewStore);
    splitViewStore.toggleSplitView(sheetId2);
    await nextTick();

    // Left pane (S1, focused) → scroll via global
    const leftScroll = 230;
    model.dispatch("SET_VIEWPORT_OFFSET", { offsetX: 0, offsetY: leftScroll });

    // Right pane (S2, inactive) → scroll via per-pane
    const rightScroll = 460;
    model.dispatch("SET_VIEWPORT_OFFSET", {
      offsetX: 0,
      offsetY: rightScroll,
      sheetId: sheetId2,
      paneId: "right",
    });

    // Click right pane → right becomes focused (S2 active, global = rightScroll)
    const panes = fixture.querySelectorAll(".o-spreadsheet-pane");
    (panes[1] as HTMLElement).click();
    await nextTick();

    expect(model.getters.getActiveSheetScrollInfo(sheetId2).scrollY).toBe(rightScroll);
    expect(model.getters.getActiveSheetScrollInfo(sheetId1, "left").scrollY).toBe(leftScroll);

    // Click left pane → left becomes focused again (S1 active, global = leftScroll)
    (panes[0] as HTMLElement).click();
    await nextTick();

    expect(model.getters.getActiveSheetScrollInfo(sheetId1).scrollY).toBe(leftScroll);
    expect(model.getters.getActiveSheetScrollInfo(sheetId2, "right").scrollY).toBe(rightScroll);
  });

  test("Selecting a cell in focused pane does not scroll the inactive pane", async () => {
    const { model, env } = await mountSpreadsheet();
    const sheetId1 = model.getters.getActiveSheetId();

    const splitViewStore = env.getStore(SplitViewStore);
    splitViewStore.toggleSplitView(sheetId1); // same sheet in both panes
    await nextTick();

    // Pre-scroll the inactive (right) pane to a distinct position
    model.dispatch("SET_VIEWPORT_OFFSET", {
      offsetX: 0,
      offsetY: 500,
      sheetId: sheetId1,
      paneId: "right",
    });
    expect(model.getters.getActiveSheetScrollInfo(sheetId1, "right").scrollY).toBe(500);

    // Scroll-to-cell in the focused (left) pane — uses its per-pane viewport
    model.dispatch("SCROLL_TO_CELL", { col: 0, row: 50, paneId: "left" });
    await nextTick();

    // Focused left pane should have scrolled
    expect(model.getters.getActiveSheetScrollInfo(sheetId1, "left").scrollY).toBeGreaterThan(0);
    // Inactive right pane should remain at 500
    expect(model.getters.getActiveSheetScrollInfo(sheetId1, "right").scrollY).toBe(500);
  });

  test("Keyboard navigation in focused pane does not scroll the inactive pane", async () => {
    const { model, env } = await mountSpreadsheet();
    const sheetId1 = model.getters.getActiveSheetId();

    const splitViewStore = env.getStore(SplitViewStore);
    splitViewStore.toggleSplitView(sheetId1);
    await nextTick();

    // Pre-scroll inactive pane to a distinct position
    model.dispatch("SET_VIEWPORT_OFFSET", {
      offsetX: 300,
      offsetY: 400,
      sheetId: sheetId1,
      paneId: "right",
    });

    // Simulate keyboard navigation in focused pane by scrolling it
    model.dispatch("SCROLL_TO_CELL", { col: 0, row: 50, paneId: "left" });
    await nextTick();

    // Inactive right pane scroll should be unchanged
    expect(model.getters.getActiveSheetScrollInfo(sheetId1, "right")).toEqual({
      scrollX: 300,
      scrollY: 400,
    });
  });
});
