import { Rect } from "@odoo/o-spreadsheet-engine";
import { Component, useRef, useState } from "@odoo/owl";
import { Popover, PopoverProps } from "../../../popover/popover";
import { MarkerPreview } from "./marker_preview";

export interface MarkerSelectorProps {
  marker: string;
  onMarkerPicked: (marker: string) => void;
  title: string;
  position: "start" | "end";
}

const MARKER_STYLES = [
  { value: "", label: "None" },
  { value: "arrow", label: "Arrow" },
  { value: "circle", label: "Circle" },
  { value: "circle_empty", label: "Circle (Empty)" },
  { value: "square", label: "Square" },
  { value: "square_empty", label: "Square (Empty)" },
  { value: "diamond", label: "Diamond" },
  { value: "diamond_empty", label: "Diamond (Empty)" },
];

export class MarkerSelector extends Component<MarkerSelectorProps> {
  static template = "o-spreadsheet-MarkerSelector";
  static components = { Popover, MarkerPreview };
  static props = {
    marker: { type: String, optional: true },
    onMarkerPicked: Function,
    title: String,
    position: String,
  };

  markerStyles = MARKER_STYLES;
  buttonRef = useRef("markerSelectorButton");

  state = useState({
    isOpen: false,
  });

  toggleDropdown() {
    this.state.isOpen = !this.state.isOpen;
  }

  onMarkerPicked(value: string) {
    this.props.onMarkerPicked(value);
    this.state.isOpen = false;
  }

  get popoverProps(): PopoverProps {
    return {
      anchorRect: this.getAnchorRect(this.buttonRef),
      positioning: "bottom-left",
      verticalOffset: 0,
    };
  }

  getAnchorRect(ref: any): Rect {
    const button = ref.el;
    if (button === null) {
      return { x: 0, y: 0, width: 0, height: 0 };
    }
    const buttonRect = button.getBoundingClientRect();
    return {
      x: buttonRect.x,
      y: buttonRect.y,
      width: buttonRect.width,
      height: buttonRect.height,
    };
  }
}
