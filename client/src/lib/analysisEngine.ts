import type { ChartType } from "@shared/schema";
import type { ParsedData } from "@/lib/chartEngine";

export type AnalysisGoal = "distribution" | "trend" | "relationship" | "comparison";
export type InferredColumnType = "number" | "category" | "datetime";

export interface InferredColumn {
  index: number;
  name: string;
  type: InferredColumnType;
  uniqueCount: number;
  missingCount: number;
}

export interface FieldMapping {
  xAxisColumn: number | null;
  yAxisColumn: number | null;
  groupColumn: number | null;
}

export interface ChartRecommendation {
  chartType: ChartType;
  available: boolean;
  priority: number;
  reason: string;
  mapping: FieldMapping;
}

function isMissing(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function isNumeric(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !Number.isNaN(Number(trimmed));
}

function isDateLike(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (!/[\\/\-:T]/.test(trimmed)) return false;
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed);
}

export function inferColumns(data: ParsedData): InferredColumn[] {
  return data.headers.map((header, index) => {
    const values = data.rows.map((row) => row[index]);
    const nonMissing = values.filter((value) => !isMissing(value));
    const missingCount = values.length - nonMissing.length;
    const uniqueCount = new Set(nonMissing.map((value) => String(value))).size;
    const observed = Math.max(nonMissing.length, 1);

    const numericRate = nonMissing.filter(isNumeric).length / observed;
    const datetimeRate = nonMissing.filter(isDateLike).length / observed;

    let type: InferredColumnType = "category";
    if (datetimeRate >= 0.7) {
      type = "datetime";
    } else if (numericRate >= 0.8) {
      type = "number";
    }

    return {
      index,
      name: header.trim() || `column_${index + 1}`,
      type,
      uniqueCount,
      missingCount,
    };
  });
}

function getColumn(columns: InferredColumn[], index: number | null): InferredColumn | null {
  if (index == null) return null;
  return columns.find((column) => column.index === index) ?? null;
}

function firstColumnOfType(
  columns: InferredColumn[],
  type: InferredColumnType,
  excluded: number[] = [],
): InferredColumn | null {
  return columns.find((column) => column.type === type && !excluded.includes(column.index)) ?? null;
}

function typeLabel(type: InferredColumnType): string {
  if (type === "number") return "数值";
  if (type === "datetime") return "时间";
  return "分类";
}

function columnLabel(column: InferredColumn | null): string {
  return column ? `${column.name}（${typeLabel(column.type)}）` : "未选择";
}

const CHART_TYPE_ORDER: ChartType[] = [
  "histogram",
  "boxplot",
  "line",
  "scatter",
  "bar",
  "barH",
  "area",
  "pie",
  "radar",
  "heatmap",
  "violin",
];

function sortRecommendations(recommendations: ChartRecommendation[]): ChartRecommendation[] {
  return [...recommendations].sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    if (a.priority !== b.priority) return a.priority - b.priority;
    return CHART_TYPE_ORDER.indexOf(a.chartType) - CHART_TYPE_ORDER.indexOf(b.chartType);
  });
}

export function suggestDefaultMapping(
  goal: AnalysisGoal,
  columns: InferredColumn[],
): FieldMapping {
  const firstNumber = firstColumnOfType(columns, "number");
  const secondNumber = firstColumnOfType(columns, "number", [firstNumber?.index ?? -1]);
  const firstCategory = firstColumnOfType(columns, "category");
  const secondCategory = firstColumnOfType(columns, "category", [firstCategory?.index ?? -1]);
  const firstDatetime = firstColumnOfType(columns, "datetime");

  if (goal === "trend") {
    return {
      xAxisColumn: firstDatetime?.index ?? firstNumber?.index ?? null,
      yAxisColumn: secondNumber?.index ?? null,
      groupColumn: firstCategory?.index ?? null,
    };
  }

  if (goal === "relationship") {
    return {
      xAxisColumn: firstNumber?.index ?? null,
      yAxisColumn: secondNumber?.index ?? null,
      groupColumn: firstCategory?.index ?? null,
    };
  }

  if (goal === "comparison") {
    return {
      xAxisColumn: firstCategory?.index ?? null,
      yAxisColumn: firstNumber?.index ?? null,
      groupColumn: secondCategory?.index ?? null,
    };
  }

  return {
    xAxisColumn: firstNumber?.index ?? null,
    yAxisColumn: null,
    groupColumn: firstCategory?.index ?? null,
  };
}

function recommendation(
  chartType: ChartType,
  available: boolean,
  priority: number,
  reason: string,
  mapping: FieldMapping,
): ChartRecommendation {
  return { chartType, available, priority, reason, mapping };
}

function buildHistogramRecommendation(columns: InferredColumn[], mapping: FieldMapping): ChartRecommendation {
  const xColumn = getColumn(columns, mapping.xAxisColumn);
  const yColumn = getColumn(columns, mapping.yAxisColumn);
  const groupColumn = getColumn(columns, mapping.groupColumn);
  const numericTarget = xColumn?.type === "number" ? xColumn : null;
  const available = Boolean(numericTarget) && mapping.yAxisColumn == null && (!groupColumn || groupColumn.type === "category");

  return recommendation(
    "histogram",
    available,
    available ? 0 : 100,
    available
      ? `检测到单个数值目标列 ${columnLabel(numericTarget)}，因此优先推荐直方图查看分布；如需分组，可用分类列作为分组。`
      : yColumn?.type === "number"
        ? "直方图只能保留一个数值目标列，当前映射同时占用了 X 和 Y。请把 Y 清空，并将分类列放到分组位。"
        : "直方图需要把 X 轴作为唯一数值目标列，Y 轴留空，分组列只能来自分类字段。",
    {
      xAxisColumn: numericTarget?.index ?? firstColumnOfType(columns, "number")?.index ?? null,
      yAxisColumn: null,
      groupColumn: groupColumn?.type === "category" ? groupColumn.index : firstColumnOfType(columns, "category")?.index ?? null,
    },
  );
}

function buildLineRecommendation(columns: InferredColumn[], mapping: FieldMapping): ChartRecommendation {
  const xColumn = getColumn(columns, mapping.xAxisColumn);
  const yColumn = getColumn(columns, mapping.yAxisColumn);
  const groupColumn = getColumn(columns, mapping.groupColumn);
  const available = Boolean(
    (xColumn?.type === "datetime" || xColumn?.type === "number") &&
      yColumn?.type === "number" &&
      xColumn.index !== yColumn.index,
  );
  const fallbackX = firstColumnOfType(columns, "datetime") ?? firstColumnOfType(columns, "number");
  const fallbackY = firstColumnOfType(columns, "number", [fallbackX?.index ?? -1]);

  return recommendation(
    "line",
    available,
    available ? 0 : 100,
    available
      ? xColumn?.type === "datetime"
        ? `检测到时间列 ${columnLabel(xColumn)} 与数值列 ${columnLabel(yColumn)}，因此优先推荐折线图查看趋势。`
        : `检测到可排序数值列 ${columnLabel(xColumn)} 与数值列 ${columnLabel(yColumn)}，因此优先推荐折线图查看变化。`
      : "折线图需要一个可排序的 X（时间或顺序轴）和一个数值 Y，当前映射不满足。",
    {
      xAxisColumn: xColumn?.type === "datetime" || xColumn?.type === "number" ? xColumn.index : fallbackX?.index ?? null,
      yAxisColumn: yColumn?.type === "number" && xColumn?.index !== yColumn.index ? yColumn.index : fallbackY?.index ?? null,
      groupColumn: groupColumn?.type === "category" ? groupColumn.index : firstColumnOfType(columns, "category")?.index ?? null,
    },
  );
}

function buildScatterRecommendation(columns: InferredColumn[], mapping: FieldMapping): ChartRecommendation {
  const xColumn = getColumn(columns, mapping.xAxisColumn);
  const yColumn = getColumn(columns, mapping.yAxisColumn);
  const available = xColumn?.type === "number" && yColumn?.type === "number" && xColumn.index !== yColumn.index;
  const fallbackX = firstColumnOfType(columns, "number");
  const fallbackY = firstColumnOfType(columns, "number", [fallbackX?.index ?? -1]);

  return recommendation(
    "scatter",
    available,
    available ? 0 : 100,
    available
      ? `检测到两个不同的数值列 ${columnLabel(xColumn)} 和 ${columnLabel(yColumn)}，因此优先推荐散点图查看相关关系。`
      : "散点图需要两个不同的数值列分别作为 X 和 Y，当前映射不满足。",
    {
      xAxisColumn: xColumn?.type === "number" ? xColumn.index : fallbackX?.index ?? null,
      yAxisColumn: yColumn?.type === "number" && xColumn?.index !== yColumn.index ? yColumn.index : fallbackY?.index ?? null,
      groupColumn: firstColumnOfType(columns, "category")?.index ?? null,
    },
  );
}

function buildBoxplotRecommendation(columns: InferredColumn[], mapping: FieldMapping): ChartRecommendation {
  const xColumn = getColumn(columns, mapping.xAxisColumn);
  const yColumn = getColumn(columns, mapping.yAxisColumn);
  const available = xColumn?.type === "category" && yColumn?.type === "number";
  const fallbackX = firstColumnOfType(columns, "category");
  const fallbackY = firstColumnOfType(columns, "number");

  return recommendation(
    "boxplot",
    available,
    available ? 0 : 100,
    available
      ? `检测到分类列 ${columnLabel(xColumn)} 和数值列 ${columnLabel(yColumn)}，因此优先推荐箱线图比较组间差异。`
      : "箱线图需要分类列作为 X、数值列作为 Y；当前还没有形成可用的分组比较映射。",
    {
      xAxisColumn: xColumn?.type === "category" ? xColumn.index : fallbackX?.index ?? null,
      yAxisColumn: yColumn?.type === "number" ? yColumn.index : fallbackY?.index ?? null,
      groupColumn: firstColumnOfType(columns, "category", [fallbackX?.index ?? -1])?.index ?? null,
    },
  );
}

function buildBarRecommendation(columns: InferredColumn[], mapping: FieldMapping): ChartRecommendation {
  const xColumn = getColumn(columns, mapping.xAxisColumn);
  const yColumn = getColumn(columns, mapping.yAxisColumn);
  const available = xColumn?.type === "category" && yColumn?.type === "number";
  const fallbackX = firstColumnOfType(columns, "category");
  const fallbackY = firstColumnOfType(columns, "number");

  return recommendation(
    "bar",
    available,
    available ? 1 : 101,
    available
      ? `检测到分类列 ${columnLabel(xColumn)} 和数值列 ${columnLabel(yColumn)}，因此可用柱状图做组间对比。`
      : "柱状图需要分类列作为 X、数值列作为 Y；当前映射不满足。",
    {
      xAxisColumn: xColumn?.type === "category" ? xColumn.index : fallbackX?.index ?? null,
      yAxisColumn: yColumn?.type === "number" ? yColumn.index : fallbackY?.index ?? null,
      groupColumn: firstColumnOfType(columns, "category", [fallbackX?.index ?? -1])?.index ?? null,
    },
  );
}

export function recommendCharts(
  goal: AnalysisGoal,
  columns: InferredColumn[],
  mapping: FieldMapping,
): ChartRecommendation[] {
  if (goal === "distribution") {
    return sortRecommendations([
      buildHistogramRecommendation(columns, mapping),
      buildBoxplotRecommendation(columns, mapping),
    ]);
  }

  if (goal === "trend") {
    return sortRecommendations([buildLineRecommendation(columns, mapping)]);
  }

  if (goal === "relationship") {
    return sortRecommendations([buildScatterRecommendation(columns, mapping)]);
  }

  return sortRecommendations([
    buildBoxplotRecommendation(columns, mapping),
    buildBarRecommendation(columns, mapping),
  ]);
}

export function goalLabel(goal: AnalysisGoal): string {
  switch (goal) {
    case "distribution":
      return "分布";
    case "trend":
      return "趋势";
    case "relationship":
      return "关系";
    case "comparison":
      return "对比";
  }
}

