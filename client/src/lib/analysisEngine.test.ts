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

function chartTypesOf(recommendations: ReturnType<typeof recommendCharts>) {
  return recommendations.map((item) => item.chartType);
}

test("inferColumns 推断类型并统计 missing/unique", () => {
  const cols = inferColumns(sample);
  assert.equal(cols[0].type, "datetime");
  assert.equal(cols[1].type, "category");
  assert.equal(cols[2].type, "number");
  assert.equal(cols[0].missingCount, 1);
  assert.equal(cols[1].uniqueCount, 2);
});

test("distribution 默认映射只保留一个数值目标列", () => {
  const cols = inferColumns(sample);
  const mapping = suggestDefaultMapping("distribution", cols);
  assert.equal(mapping.xAxisColumn, 2);
  assert.equal(mapping.yAxisColumn, null);
  assert.equal(mapping.groupColumn, 1);
});

test("trend 只推荐折线图，不再推荐直方图", () => {
  const cols = inferColumns(sample);
  const mapping = suggestDefaultMapping("trend", cols);
  const recs = recommendCharts("trend", cols, mapping);
  assert.deepEqual(chartTypesOf(recs), ["line"]);
  assert.equal(recs[0].available, true);
  assert.match(recs[0].reason, /时间列|顺序轴/);
});

test("distribution 不推荐趋势或关系图", () => {
  const cols = inferColumns(sample);
  const mapping = suggestDefaultMapping("distribution", cols);
  const recs = recommendCharts("distribution", cols, mapping);
  assert.deepEqual(chartTypesOf(recs), ["histogram", "boxplot"]);
  assert.equal(recs[0].available, true);
  assert.equal(recs[1].available, false);
  assert.match(recs[0].reason, /直方图/);
  assert.match(recs[1].reason, /箱线图/);
});

test("relationship 需要两个不同的数值列", () => {
  const cols = inferColumns(sample);
  const mapping = { xAxisColumn: 2, yAxisColumn: 2, groupColumn: 1 };
  const recs = recommendCharts("relationship", cols, mapping);
  assert.deepEqual(chartTypesOf(recs), ["scatter"]);
  assert.equal(recs[0].available, false);
  assert.match(recs[0].reason, /两个不同的数值列/);
});

test("comparison 返回箱线图和柱状图且 available 优先", () => {
  const cols = inferColumns(sample);
  const mapping = suggestDefaultMapping("comparison", cols);
  const recs = recommendCharts("comparison", cols, mapping);
  assert.deepEqual(chartTypesOf(recs), ["boxplot", "bar"]);
  assert.equal(recs[0].available, true);
  assert.equal(recs[1].available, true);
  assert.ok(recs[0].priority <= recs[1].priority);
});

test("无效 mapping 会返回清晰中文 reason", () => {
  const cols = inferColumns({ headers: ["group", "value"], rows: [["A", 1], ["B", 2]] });
  const mapping = { xAxisColumn: 1, yAxisColumn: 1, groupColumn: 0 };
  const recs = recommendCharts("distribution", cols, mapping);
  assert.equal(recs[0].available, false);
  assert.match(recs[0].reason, /一个数值目标列|留空/);
});

