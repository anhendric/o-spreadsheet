import { deepEquals } from "../../../helpers/misc";
import { BoundedRange, UID } from "../../../types";
import { RTreeBoundingBox, RTreeItem, SpreadsheetRTree } from "./r_tree";
import { RangeSet } from "./range_set";

interface CompactZoneItem {
  boundingBox: RTreeBoundingBox;
  data: RangeSet;
}

type RTreeRangeItem = RTreeItem<BoundedRange>;

/**
 * R-Tree of ranges, mapping zones (r-tree bounding boxes) to ranges (data of the r-tree item).
 * Ranges associated to the exact same bounding box are grouped together
 * to reduce the number of nodes in the R-tree.
 */
export class RangeRTree {
  private readonly rTree: SpreadsheetRTree<RangeSet>;

  constructor(items: RTreeRangeItem[] = []) {
    const compactedItems = groupDataPointingToSameBoundingBox(items);
    this.rTree = new SpreadsheetRTree(compactedItems);
  }

  insert(item: RTreeRangeItem) {
    const data = this.rTree.search(item.boundingBox);
    const exactBoundingBox = data.find((d) => deepEquals(d.boundingBox, item.boundingBox));
    if (exactBoundingBox) {
      exactBoundingBox.data.add(item.data);
    } else {
      this.rTree.insert({ ...item, data: new RangeSet([item.data]) });
    }
  }

  search({ zone, sheetId }: RTreeBoundingBox): RTreeRangeItem[] {
    // TODO return RangeSet?
    const results: RTreeRangeItem[] = [];
    for (const { boundingBox, data } of this.rTree.search({ zone, sheetId })) {
      for (const range of data) {
        results.push({ boundingBox, data: range });
      }
    }
    return results;
  }

  remove(item: RTreeRangeItem) {
    // FIXME. It doesn't work, but rTree.remove doesn't work either ¯_ (ツ)_/¯
    this.rTree.remove({ ...item, data: new RangeSet([item.data]) });
  }
}

/**
 * The goal is to optimize the following case:
 * - if any cell in B1:B1000 changes, C1 must be recomputed
 * - if any cell in B1:B1000 changes, C2 must be recomputed
 * - if any cell in B1:B1000 changes, C3 must be recomputed
 * ...
 * - if any cell in B1:B1000 changes, C1000 must be recomputed
 *
 * Instead of having 1000 entries in the R-tree, we want to have a single entry
 * with B1:B1000 (bounding box) pointing to C1:C1000 (data).
 *
 * This function groups together all data pointing to the exact same bounding box.
 */
function groupDataPointingToSameBoundingBox(items: RTreeRangeItem[]): CompactZoneItem[] {
  /**
   * Random notes;
   * if data is grouped (C1:C1000), it's very likely that C1:C1000 will all change together.
   * Which means that the following case is very likely to be optimizable:
   * - if C1 changes, D1 must be recomputed
   * - if C2 changes, D2 must be recomputed
   * ...
   * - if C1000 changes, D1000 must be recomputed
   * We would like to group all bounding boxes (C1, C2, ..., C1000) into a single bounding box (C1:C1000)
   * pointing to D1:D1000.
   * This is not strictly speaking correct, because if only C1 changes, we will recompute D1:D1000 instead of only D1.
   * But in practice, it's likely that if C1 changes, C2:C1000 will change too.
   * So it's a trade-off between accuracy and performance.
   */
  // This function must be as fast as possible.
  // It's critical to efficiently build the optimized R-tree.
  // If it's slow, there's no point at using an optimized R-tree.
  let maxCol = 0;
  let maxRow = 0;
  for (let i = 0; i < items.length; i++) {
    const zone = items[i].boundingBox.zone;
    if (zone.right > maxCol) {
      maxCol = zone.right;
    }
    if (zone.bottom > maxRow) {
      maxRow = zone.bottom;
    }
  }
  maxCol += 1;
  maxRow += 1;

  // in most real-world cases, we can use a fast numeric key
  // but if the zones are too large, we fallback to a slower string key
  const maxPossibleKey =
    maxCol + maxRow * maxCol + maxCol * maxCol * maxRow + maxRow * maxCol * maxRow * maxCol;
  const useFastKey = maxPossibleKey <= Number.MAX_SAFE_INTEGER;
  if (!useFastKey) {
    console.warn("Too large zones to compact, using slow zone key");
  }
  const compactedMap: Record<UID, Record<string, CompactZoneItem>> = {};
  for (const item of items) {
    const sheetId = item.boundingBox.sheetId;
    if (!compactedMap[sheetId]) {
      compactedMap[sheetId] = {};
    }
    const zone = item.boundingBox.zone;
    let key: number | string = 0;
    if (useFastKey) {
      key =
        zone.left +
        zone.top * maxCol +
        zone.right * maxCol * maxRow +
        zone.bottom * maxCol * maxRow * maxCol;
    } else {
      key = `${zone.left},${zone.top},${zone.right},${zone.bottom}`;
    }
    if (compactedMap[sheetId][key]) {
      compactedMap[sheetId][key].data.add(item.data);
    } else {
      compactedMap[sheetId][key] = {
        boundingBox: item.boundingBox,
        data: new RangeSet([item.data]),
      };
    }
  }
  const result: CompactZoneItem[] = [];
  for (const sheetId in compactedMap) {
    const map = compactedMap[sheetId];
    for (const key in map) {
      result.push(map[key]);
    }
  }
  return result;
}
