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

export function suggestDefaultMapping(
  goal: AnalysisGoal,
  columns: InferredColumn[],
): FieldMapping {
  const numberCols = columns.filter((col) => col.type === "number");
  const categoryCols = columns.filter((col) => col.type === "category");
  const datetimeCols = columns.filter((col) => col.type === "datetime");

  if (goal === "trend") {
    return {
      xAxisColumn: datetimeCols[0]?.index ?? columns[0]?.index ?? null,
      yAxisColumn: numberCols[0]?.index ?? null,
      groupColumn: categoryCols[0]?.index ?? null,
    };
  }

  if (goal === "relationship") {
    return {
      xAxisColumn: numberCols[0]?.index ?? null,
      yAxisColumn: numberCols[1]?.index ?? numberCols[0]?.index ?? null,
      groupColumn: categoryCols[0]?.index ?? null,
    };
  }

  if (goal === "comparison") {
    return {
      xAxisColumn: categoryCols[0]?.index ?? columns[0]?.index ?? null,
      yAxisColumn: numberCols[0]?.index ?? null,
      groupColumn: categoryCols[1]?.index ?? null,
    };
  }

  return {
    xAxisColumn: numberCols[0]?.index ?? columns[0]?.index ?? null,
    yAxisColumn: numberCols[0]?.index ?? null,
    groupColumn: categoryCols[0]?.index ?? null,
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

function hasType(columns: InferredColumn[], index: number | null, type: InferredColumnType): boolean {
  if (index == null) return false;
  return columns.some((col) => col.index === index && col.type === type);
}

export function recommendCharts(
  goal: AnalysisGoal,
  columns: InferredColumn[],
  mapping: FieldMapping,
): ChartRecommendation[] {
  const xIsNumber = hasType(columns, mapping.xAxisColumn, "number");
  const xIsCategory = hasType(columns, mapping.xAxisColumn, "category");
  const xIsDatetime = hasType(columns, mapping.xAxisColumn, "datetime");
  const yIsNumber = hasType(columns, mapping.yAxisColumn, "number");
  const groupIsCategory = hasType(columns, mapping.groupColumn, "category");

  if (goal === "distribution") {
    const sourceIsNumber = yIsNumber || xIsNumber;
    const numericIndex = yIsNumber ? mapping.yAxisColumn : mapping.xAxisColumn;

    return [
      recommendation(
        "histogram",
        sourceIsNumber,
        1,
        sourceIsNumber
          ? "分布分析推荐直方图，可快速查看数值频率分布。"
          : "需要至少一个数值列才能生成直方图。",
        { xAxisColumn: numericIndex, yAxisColumn: numericIndex, groupColumn: null },
      ),
      recommendation(
        "boxplot",
        sourceIsNumber,
        2,
        sourceIsNumber
          ? "箱线图适合观察中位数、四分位与异常值。"
          : "需要至少一个数值列才能生成箱线图。",
        { xAxisColumn: groupIsCategory ? mapping.groupColumn : mapping.xAxisColumn, yAxisColumn: numericIndex, groupColumn: mapping.groupColumn },
      ),
    ];
  }

  if (goal === "trend") {
    const available = (xIsDatetime && yIsNumber) || yIsNumber;
    return [
      recommendation(
        "line",
        available,
        1,
        xIsDatetime && yIsNumber
          ? "时间列 + 数值列，适合趋势线图。"
          : yIsNumber
            ? "未检测到时间列，使用有序索引展示趋势。"
            : "趋势分析需要一个数值列。",
        mapping,
      ),
    ];
  }

  if (goal === "relationship") {
    const available = xIsNumber && yIsNumber && mapping.xAxisColumn !== mapping.yAxisColumn;
    return [
      recommendation(
        "scatter",
        available,
        1,
        available
          ? "两个数值列适合散点关系分析。"
          : "关系分析需要两个不同的数值列。",
        mapping,
      ),
    ];
  }

  const comparisonAvailable = xIsCategory && yIsNumber;
  return [
    recommendation(
      "boxplot",
      comparisonAvailable,
      1,
      comparisonAvailable
        ? "分类 + 数值组合，优先推荐箱线图比较分布。"
        : "比较分析需要分类列作为 X，数值列作为 Y。",
      mapping,
    ),
    recommendation(
      "bar",
      comparisonAvailable,
      2,
      comparisonAvailable
        ? "柱状图适合展示各分类的聚合值。"
        : "分类列或数值列不足，暂不可生成柱状图。",
      mapping,
    ),
  ];
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
