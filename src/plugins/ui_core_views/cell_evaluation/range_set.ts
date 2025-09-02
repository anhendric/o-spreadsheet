import { positionToRange } from "../../../helpers";
import { CellPosition, Range, UID } from "../../../types";
import { ZoneSet } from "./zone_set";

export class RangeSet {
  private setsBySheetId: Record<UID, ZoneSet> = {};

  constructor(ranges: Iterable<Range> = []) {
    for (const range of ranges) {
      this.add(range);
    }
  }

  add(range: Range) {
    if (!this.setsBySheetId[range.sheetId]) {
      this.setsBySheetId[range.sheetId] = new ZoneSet();
    }
    this.setsBySheetId[range.sheetId].add(range.unboundedZone);
  }

  addMany(ranges: Iterable<Range>) {
    for (const range of ranges) {
      this.add(range);
    }
  }

  addPosition(position: CellPosition) {
    this.add(positionToRange(position));
  }

  addManyPositions(positions: Iterable<CellPosition>) {
    for (const position of positions) {
      this.addPosition(position);
    }
  }

  has(range: Range): boolean {
    if (!this.setsBySheetId[range.sheetId]) {
      return false;
    }
    return this.setsBySheetId[range.sheetId].has(range.zone);
  }

  hasPosition(position: CellPosition): boolean {
    return this.has(positionToRange(position));
  }

  delete(range: Range) {
    if (!this.setsBySheetId[range.sheetId]) {
      return;
    }
    this.setsBySheetId[range.sheetId].delete(range.unboundedZone);
  }

  deleteMany(ranges: Iterable<Range>) {
    for (const range of ranges) {
      this.delete(range);
    }
  }

  deleteManyPositions(positions: Iterable<CellPosition>) {
    for (const position of positions) {
      this.delete(positionToRange(position));
    }
  }

  difference(other: RangeSet): RangeSet {
    const result = new RangeSet();
    for (const sheetId in this.setsBySheetId) {
      result.setsBySheetId[sheetId] = this.setsBySheetId[sheetId];
    }
    for (const sheetId in other.setsBySheetId) {
      if (result.setsBySheetId[sheetId]) {
        result.setsBySheetId[sheetId] = result.setsBySheetId[sheetId].difference(
          other.setsBySheetId[sheetId]
        );
      }
    }
    return result;
  }

  clear() {
    this.setsBySheetId = {};
  }

  isEmpty(): boolean {
    for (const sheetId in this.setsBySheetId) {
      if (!this.setsBySheetId[sheetId].isEmpty()) {
        return false;
      }
    }
    return true;
  }

  /**
   * iterator of all the ranges in the RangeSet
   */
  *[Symbol.iterator](): IterableIterator<Range> {
    for (const sheetId in this.setsBySheetId) {
      for (const zone of this.setsBySheetId[sheetId]) {
        yield { sheetId: sheetId, zone, unboundedZone: zone };
      }
    }
  }
}
