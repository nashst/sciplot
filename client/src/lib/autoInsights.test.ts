import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDatasetProfile,
  recommendVisualization,
} from "./autoInsights";

test("time series chooses line", () => {
  const profile = buildDatasetProfile({
    headers: ["Time", "Value"],
    rows: [
      ["2025-01-01", 1],
      ["2025-01-02", 2],
      ["2025-01-03", 3],
    ],
  });

  const rec = recommendVisualization(profile);

  assert.equal(rec.chartType, "line");
  assert.equal(rec.xAxisIndex, 0);
  assert.deepEqual(rec.yAxisIndices, [1]);
  assert.match(rec.reason, /time/i);
});

test("category plus numeric chooses bar", () => {
  const profile = buildDatasetProfile({
    headers: ["Category", "Value"],
    rows: [
      ["A", 10],
      ["B", 20],
      ["C", 30],
    ],
  });

  const rec = recommendVisualization(profile);

  assert.equal(rec.chartType, "bar");
  assert.equal(rec.xAxisIndex, 0);
  assert.deepEqual(rec.yAxisIndices, [1]);
  assert.match(rec.reason, /categor/i);
});

test("two numerics choose scatter", () => {
  const profile = buildDatasetProfile({
    headers: ["X", "Y"],
    rows: [
      [1, 2],
      [2, 4],
      [3, 6],
    ],
  });

  const rec = recommendVisualization(profile);

  assert.equal(rec.chartType, "scatter");
  assert.equal(rec.xAxisIndex, 0);
  assert.deepEqual(rec.yAxisIndices, [1]);
  assert.match(rec.reason, /scatter/i);
});

test("profile reports missing values", () => {
  const profile = buildDatasetProfile({
    headers: ["Category", "Value"],
    rows: [
      ["A", 1],
      ["", 2],
      ["C", null],
      [undefined, 4],
    ],
  });

  assert.equal(profile.rowCount, 4);
  assert.equal(profile.columnCount, 2);
  assert.equal(profile.columns[0].missingCount, 2);
  assert.equal(profile.columns[1].missingCount, 1);
  assert.ok(profile.warnings.some((warning) => warning.toLowerCase().includes("missing")));
});
