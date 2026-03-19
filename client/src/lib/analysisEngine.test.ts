import test from "node:test";
import assert from "node:assert/strict";

import {
  inferColumns,
  recommendCharts,
  suggestDefaultMapping,
  type AnalysisGoal,
} from "./analysisEngine";

const sample = {
  headers: ["time", "group", "x", "y"],
  rows: [
    ["2026-01-01", "A", 1, 2],
    ["2026-01-02", "B", 2, 4],
    ["2026-01-03", "A", 3, 6],
    ["", "B", 4, ""],
  ],
};

test("inferColumns 推断类型并统计 missing/unique", () => {
  const cols = inferColumns(sample);
  assert.equal(cols[0].type, "datetime");
  assert.equal(cols[1].type, "category");
  assert.equal(cols[2].type, "number");
  assert.equal(cols[0].missingCount, 1);
  assert.equal(cols[1].uniqueCount, 2);
});

for (const goal of ["distribution", "trend", "relationship", "comparison"] as AnalysisGoal[]) {
  test(`recommendCharts ${goal} 至少返回一项推荐`, () => {
    const cols = inferColumns(sample);
    const mapping = suggestDefaultMapping(goal, cols);
    const recs = recommendCharts(goal, cols, mapping);
    assert.ok(recs.length > 0);
    assert.ok(recs[0].chartType.length > 0);
  });
}

test("不可用推荐返回 reason", () => {
  const cols = inferColumns({ headers: ["group"], rows: [["A"], ["B"]] });
  const mapping = suggestDefaultMapping("relationship", cols);
  const recs = recommendCharts("relationship", cols, mapping);
  assert.equal(recs[0].available, false);
  assert.ok(recs[0].reason.length > 0);
});
