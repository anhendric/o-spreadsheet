import { BarController, BarElement, Chart, ChartComponent } from "chart.js";
import { AnyObject } from "chart.js/dist/types/basic";

export function getBoxPlotChartController(): ChartComponent & {
  prototype: BarController;
  new (chart: Chart, datasetIndex: number): BarController;
} {
  if (!globalThis.Chart) {
    throw new Error("Chart.js library is not loaded");
  }
  return class BoxPlotController extends globalThis.Chart.BarController {
    static id = "boxplot";
    static defaults = {
      ...globalThis.Chart?.BarController.defaults,
      dataElementType: "boxplot",
    };

    /**
     * Parse the data into the structure required for the box plot.
     * We expect data to be an array of arrays: [[min, q1, median, q3, max], ...]
     */
    parse(start: number, count: number) {
      const meta = this._cachedMeta;
      const data = this.getDataset().data;
      const iScale = meta.iScale; // x-axis (category)
      const vScale = meta.vScale; // y-axis (value)

      // We need to ensure _parsed is initialized
      if (!meta._parsed) {
        meta._parsed = [];
      }

      for (let i = start; i < start + count; i++) {
        const raw = data[i] as number[];
        if (!raw || raw.length < 5 || !iScale || !vScale) {
          meta._parsed[i] = { [iScale?.axis || "x"]: i, [vScale?.axis || "y"]: null };
          continue;
        }

        // [min, q1, median, q3, max]
        meta._parsed[i] = {
          [iScale.axis]: i, // x-axis index
          [vScale.axis]: raw[4], // Use max as primary value (mostly for consistency)
          _custom: {
            min: raw[0],
            q1: raw[1],
            median: raw[2],
            q3: raw[3],
            max: raw[4],
          },
        };
      }
    }

    /**
     * Override to calculate the min/max of the data considering all statistics (whiskers).
     */
    getMinMax(scale: any) {
      const meta = this._cachedMeta;
      const parsed = meta._parsed as any[];
      const axis = scale.axis;

      if (parsed.length === 0) {
        return { min: 0, max: 1 };
      }

      // If it's the value axis (usually 'y'), calc min/max from boxstats
      if (meta.vScale && axis === meta.vScale.axis) {
        let min = Infinity;
        let max = -Infinity;
        for (const item of parsed) {
          const custom = item._custom;
          if (custom) {
            min = Math.min(min, custom.min);
            max = Math.max(max, custom.max);
          }
        }
        return { min, max };
      }

      return super.getMinMax(scale);
    }

    /**
     * Initialize properties for the elements.
     */
    updateElements(elements: any[], start: number, count: number, mode: any) {
      const reset = mode === "reset";
      const vScale = this._cachedMeta.vScale;
      if (!vScale) {
        super.updateElements(elements, start, count, mode);
        return;
      }
      const base = vScale.getBasePixel();

      super.updateElements(elements, start, count, mode);

      for (let i = start; i < start + count; i++) {
        const elem = elements[i];
        const index = start + i;
        const parsed = this._cachedMeta._parsed[index] as any;
        const custom = parsed._custom;

        if (custom) {
          elem.boxPlot = {
            min: reset ? base : vScale.getPixelForValue(custom.min),
            q1: reset ? base : vScale.getPixelForValue(custom.q1),
            median: reset ? base : vScale.getPixelForValue(custom.median),
            q3: reset ? base : vScale.getPixelForValue(custom.q3),
            max: reset ? base : vScale.getPixelForValue(custom.max),
          };
        } else {
          elem.boxPlot = null;
        }
      }
    }
  };
}

export function getBoxPlotChartElement(): ChartComponent & {
  prototype: BarElement;
  new (cfg: AnyObject): BarElement;
} {
  if (!globalThis.Chart) {
    throw new Error("Chart.js library is not loaded");
  }
  return class BoxPlotElement extends globalThis.Chart.BarElement {
    static id = "boxplot";

    draw(ctx: CanvasRenderingContext2D) {
      const boxPlot = (this as any).boxPlot;
      if (!boxPlot) {
        return;
      }

      ctx.save();
      const props = ["x", "width", "options"];
      const { x, width, options } = this.getProps(props) as any;
      const { min, q1, median, q3, max } = boxPlot;

      const halfWidth = width / 2;
      const left = x - halfWidth;
      const right = x + halfWidth;

      // Draw Box (Q1 to Q3)
      ctx.fillStyle = options.backgroundColor;
      ctx.strokeStyle = options.borderColor;
      ctx.lineWidth = options.borderWidth;

      // Check orientation (assuming vertical for now, Q3 is usually "higher" value but in pixels "lower" y)
      // Whichever is smaller pixel value is "top" visually
      const topBox = Math.min(q1, q3);
      const bottomBox = Math.max(q1, q3);
      const heightBox = bottomBox - topBox;

      ctx.fillRect(left, topBox, width, heightBox);
      if (options.borderWidth) {
        ctx.strokeRect(left, topBox, width, heightBox);
      }

      // Draw Median Line
      ctx.beginPath();
      ctx.moveTo(left, median);
      ctx.lineTo(right, median);
      ctx.stroke();

      // Draw Whiskers
      // Lower whisker (Min to Q1/Box Bottom)

      // Upper whisker (from box top to visual top)
      ctx.beginPath();
      ctx.moveTo(x, Math.min(q1, q3));
      ctx.lineTo(x, max); // Line to max
      ctx.stroke();

      // Lower whisker (from box bottom to visual bottom)
      ctx.beginPath();
      ctx.moveTo(x, Math.max(q1, q3));
      ctx.lineTo(x, min); // Line to min
      ctx.stroke();

      // Whisker caps (optional but good)
      ctx.beginPath();
      ctx.moveTo(left + width * 0.25, max);
      ctx.lineTo(right - width * 0.25, max);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(left + width * 0.25, min);
      ctx.lineTo(right - width * 0.25, min);
      ctx.stroke();

      ctx.restore();
    }
  };
}
