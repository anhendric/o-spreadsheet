import { Component } from "@odoo/owl";

export class MarkerPreview extends Component<any, any> {
  static template = "o-spreadsheet-MarkerPreview";
  static props = {
    marker: String,
    position: { type: String, optional: true }, // 'start' | 'end'
    width: { type: Number, optional: true },
    height: { type: Number, optional: true },
    class: { type: String, optional: true },
  };

  get width() {
    return this.props.width || 40;
  }
  get height() {
    return this.props.height || 20;
  }

  get lineStart() {
    return 5;
  }
  get lineEnd() {
    return this.width - 5;
  }
  get lineY() {
    return this.height / 2;
  }

  get cx() {
    if (this.props.position === "start") return this.lineStart;
    if (this.props.position === "end") return this.lineEnd;
    return 0; // Should not happen for styled markers
  }

  get isStart() {
    return this.props.position === "start";
  }

  getMarkerPoints(marker: string, cx: number, cy: number, isStart: boolean): string {
    if (marker === "arrow") {
      return isStart
        ? `${cx},${cy} ${cx + 10},${cy + 3.5} ${cx + 10},${cy - 3.5}`
        : `${cx},${cy} ${cx - 10},${cy - 3.5} ${cx - 10},${cy + 3.5}`;
    }
    if (marker === "diamond" || marker === "diamond_empty") {
      return isStart
        ? `${cx},${cy} ${cx + 5},${cy - 5} ${cx + 10},${cy} ${cx + 5},${cy + 5}`
        : `${cx},${cy} ${cx - 5},${cy - 5} ${cx - 10},${cy} ${cx - 5},${cy + 5}`;
    }
    return "";
  }
}
