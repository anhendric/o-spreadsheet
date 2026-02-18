import { HistogramChartRuntime } from "@odoo/o-spreadsheet-engine/types/chart/histogram_chart";
import { ChartCreationContext } from "../../../src";
import { HistogramChart } from "../../../src/helpers/figures/charts";
import { GENERAL_CHART_CREATION_CONTEXT } from "../../test_helpers/chart_helpers";
import { createChart } from "../../test_helpers/commands_helpers";
import { createModelFromGrid } from "../../test_helpers/helpers";

describe("histogram chart", () => {
  test("create histogram chart from creation context", () => {
    const context: Required<ChartCreationContext> = {
      ...GENERAL_CHART_CREATION_CONTEXT,
      range: [{ dataRange: "Sheet1!B1:B4" }],
    };
    const definition = HistogramChart.getDefinitionFromContextCreation(context);
    expect(definition).toEqual({
      type: "histogram",
      background: "#123456",
      title: { text: "hello there" },
      dataSets: [{ dataRange: "Sheet1!B1:B4" }],
      legendPosition: "top",
      dataSetsHaveTitle: true,
      axesDesign: {},
      showValues: false,
    });
  });

  test("Histogram runtime with automatic bucket size", () => {
    // 4 values: 1, 2, 8, 9.
    // Min 1, Max 9. Sqrt(4) = 2 buckets.
    // Range = 8. Bucket size = 8 / 2 = 4.
    // Buckets: [1, 5), [5, 9] (includes max)
    // 1, 2 -> Bucket 1
    // 8, 9 -> Bucket 2 (assuming 8 >= 5)

    // Logic in runtime:
    // [min, min+size), [min+size, min+2*size), ...
    // 1 -> index floor((1-1)/4) = 0
    // 2 -> index floor((2-1)/4) = 0.25 -> 0
    // 8 -> index floor((8-1)/4) = 1.75 -> 1
    // 9 -> index floor((9-1)/4) = 2 -> 2?
    // Wait, runtime logic:
    // if bucketIndex >= buckets.length (2), bucketIndex = buckets.length - 1 (1).
    // So 9 -> index 1.
    // Data: [2, 2]

    const model = createModelFromGrid({
      A1: "1",
      A2: "2",
      A3: "8",
      A4: "9",
    });
    createChart(model, { type: "histogram", dataSets: [{ dataRange: "A1:A4" }] }, "chartId");
    const runtime = model.getters.getChartRuntime("chartId") as HistogramChartRuntime;

    expect(runtime.chartJsConfig.type).toBe("bar");
    const data = runtime.chartJsConfig.data;
    expect(data.labels?.length).toBe(2);
    expect(data.datasets[0].data).toEqual([2, 2]);
    expect(data.labels).toEqual(["1 - 5", "5 - 9"]);
  });

  test("Histogram runtime with manual bucket size", () => {
    // 1, 2, 8, 9. Bucket size 2.
    // Buckets: [1, 3), [3, 5), [5, 7), [7, 9], [9, 11)?
    // Min 1, Max 9.
    // 1 -> 1-3
    // 2 -> 1-3
    // 3
    // ...
    // 8 -> 7-9
    // 9 -> 9-11
    // Let's check logic:
    // min=1, bucketSize=2.
    // current=1, next=3. bucket 0.
    // current=3, next=5. bucket 1.
    // current=5, next=7. bucket 2.
    // current=7, next=9. bucket 3. (contains 7, 8)
    // current=9, next=11. bucket 4. (contains 9, 10)
    //
    // Data count:
    // 1 -> 0
    // 2 -> 0
    // 8 -> floor((8-1)/2) = 3.5 -> 3
    // 9 -> floor((9-1)/2) = 4 -> 4

    const model = createModelFromGrid({
      A1: "1",
      A2: "2",
      A3: "8",
      A4: "9",
    });
    createChart(
      model,
      { type: "histogram", dataSets: [{ dataRange: "A1:A4" }], bucketSize: 2 },
      "chartId"
    );
    const runtime = model.getters.getChartRuntime("chartId") as HistogramChartRuntime;

    const data = runtime.chartJsConfig.data;
    expect(data.labels?.length).toBe(5); // 1-3, 3-5, 5-7, 7-9, 9-11
    // Counts: Bucket 0: 2 (1,2), Bucket 1: 0, Bucket 2: 0, Bucket 3: 1 (8), Bucket 4: 1 (9).
    expect(data.datasets[0].data).toEqual([2, 0, 0, 1, 1]);
    expect(data.labels?.[0]).toBe("1 - 3");
  });

  test("Histogram with multiple datasets", () => {
    // DS1: 1, 2
    // DS2: 8, 9
    // Auto bucket size based on global min/max (1..9) -> size 4 (same as before)
    const model = createModelFromGrid({
      A1: "1",
      A2: "2",
      B1: "8",
      B2: "9",
    });
    createChart(
      model,
      {
        type: "histogram",
        dataSets: [{ dataRange: "A1:A2" }, { dataRange: "B1:B2" }],
      },
      "chartId"
    );
    const runtime = model.getters.getChartRuntime("chartId") as HistogramChartRuntime;

    const data = runtime.chartJsConfig.data;
    expect(data.labels?.length).toBe(2);
    // DS1: 1, 2 -> Bucket 1 (2 count), Bucket 2 (0 count)
    expect(data.datasets[0].data).toEqual([2, 0]);
    // DS2: 8, 9 -> Bucket 1 (0 count), Bucket 2 (2 count)
    expect(data.datasets[1].data).toEqual([0, 2]);
  });
});
