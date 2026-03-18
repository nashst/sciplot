export type ColumnKind = "numeric" | "categorical" | "datetime" | "unknown";

export interface TableData {
  headers: string[];
  rows: Array<Array<unknown>>;
}

export interface ColumnProfile {
  index: number;
  name: string;
  kind: ColumnKind;
  totalCount: number;
  missingCount: number;
  nonMissingCount: number;
  numericCount: number;
  datetimeCount: number;
  categoricalCount: number;
}

export interface DatasetProfile {
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
  warnings: string[];
}

export interface VisualizationRecommendation {
  chartType: "line" | "bar" | "scatter";
  xAxisIndex: number;
  yAxisIndices: number[];
  reason: string;
}

const CHART_LABELS: Record<VisualizationRecommendation["chartType"], string> = {
  line: "Line chart",
  bar: "Bar chart",
  scatter: "Scatter plot",
};

const MISSING_MESSAGE_THRESHOLD = 1;

function isMissing(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function isNumericValue(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed === "") return false;
  return /^[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/.test(trimmed);
}

function isDateLikeValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed === "") return false;
  const isoLike = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(trimmed) || /^\d{4}-\d{2}-\d{2}T/.test(trimmed);
  if (!isoLike) return false;
  const parsed = Date.parse(trimmed);
  return Number.isFinite(parsed);
}

function classifyColumn(values: unknown[]): Pick<ColumnProfile, "kind" | "numericCount" | "datetimeCount" | "categoricalCount"> {
  let numericCount = 0;
  let datetimeCount = 0;
  let categoricalCount = 0;

  for (const value of values) {
    if (isMissing(value)) continue;
    if (isNumericValue(value)) {
      numericCount += 1;
      continue;
    }
    if (isDateLikeValue(value)) {
      datetimeCount += 1;
      continue;
    }
    categoricalCount += 1;
  }

  const observed = numericCount + datetimeCount + categoricalCount;
  const dominantThreshold = observed > 0 ? observed * 0.7 : 0;
  let kind: ColumnKind = "unknown";

  if (numericCount >= dominantThreshold && numericCount > 0) {
    kind = "numeric";
  } else if (datetimeCount >= dominantThreshold && datetimeCount > 0) {
    kind = "datetime";
  } else if (categoricalCount > 0) {
    kind = "categorical";
  }

  return { kind, numericCount, datetimeCount, categoricalCount };
}

export function buildDatasetProfile(data: TableData): DatasetProfile {
  const rowCount = data.rows.length;
  const columnCount = data.headers.length;
  const columns: ColumnProfile[] = data.headers.map((name, index) => {
    const values = data.rows.map((row) => row[index]);
    const missingCount = values.filter(isMissing).length;
    const nonMissingCount = values.length - missingCount;
    const { kind, numericCount, datetimeCount, categoricalCount } = classifyColumn(values);

    return {
      index,
      name,
      kind,
      totalCount: values.length,
      missingCount,
      nonMissingCount,
      numericCount,
      datetimeCount,
      categoricalCount,
    };
  });

  const warnings: string[] = [];
  const columnsWithMissing = columns.filter((column) => column.missingCount >= MISSING_MESSAGE_THRESHOLD);
  const totalMissing = columnsWithMissing.reduce((sum, column) => sum + column.missingCount, 0);
  if (totalMissing > 0) {
    const details = columnsWithMissing
      .map((column) => `${column.name}: ${column.missingCount}`)
      .join(", ");
    warnings.push(`Found ${totalMissing} missing value${totalMissing === 1 ? "" : "s"} across ${columnsWithMissing.length} column${columnsWithMissing.length === 1 ? "" : "s"} (${details}).`);
  }

  return { rowCount, columnCount, columns, warnings };
}

function firstColumnIndex(columns: ColumnProfile[], kind: ColumnKind): number {
  return columns.findIndex((column) => column.kind === kind);
}

function firstNumericAfter(columns: ColumnProfile[], startIndex: number): number {
  return columns.findIndex((column, index) => index > startIndex && column.kind === "numeric");
}

function firstNumeric(columns: ColumnProfile[]): number {
  return firstColumnIndex(columns, "numeric");
}

export function recommendVisualization(profile: DatasetProfile): VisualizationRecommendation {
  const columns = profile.columns;
  const first = columns[0];
  const firstNumericIndex = firstNumeric(columns);
  const secondNumericIndex = firstNumericIndex >= 0 ? firstNumericAfter(columns, firstNumericIndex) : -1;

  if (columns.length >= 2) {
    const x0 = columns[0];
    const x1 = columns[1];

    if (x0.kind === "datetime" && x1.kind === "numeric") {
      return {
        chartType: "line",
        xAxisIndex: 0,
        yAxisIndices: [1],
        reason: `Detected a time series: ${x0.name} looks like datetime data and ${x1.name} is numeric, so a line chart is the clearest default.`,
      };
    }

    if (x0.kind === "categorical" && x1.kind === "numeric") {
      return {
        chartType: "bar",
        xAxisIndex: 0,
        yAxisIndices: [1],
        reason: `Detected a category-to-value table: ${x0.name} is categorical and ${x1.name} is numeric, so a bar chart is the clearest default.`,
      };
    }

    if (x0.kind === "numeric" && x1.kind === "numeric") {
      return {
        chartType: "scatter",
        xAxisIndex: 0,
        yAxisIndices: [1],
        reason: `Detected two numeric columns: using ${x0.name} as x and ${x1.name} as y produces the most informative scatter plot by default.`,
      };
    }
  }

  if (first && first.kind === "datetime" && firstNumericIndex >= 1) {
    return {
      chartType: "line",
      xAxisIndex: 0,
      yAxisIndices: [firstNumericIndex],
      reason: `The first column (${first.name}) looks like time data, so a line chart is the best fallback for trend inspection.`,
    };
  }

  if (first && first.kind === "categorical" && firstNumericIndex >= 1) {
    return {
      chartType: "bar",
      xAxisIndex: 0,
      yAxisIndices: [firstNumericIndex],
      reason: `The first column (${first.name}) is categorical and the first numeric measure appears in column ${columns[firstNumericIndex].name}, so a bar chart is the best fallback.`,
    };
  }

  if (firstNumericIndex >= 0 && secondNumericIndex >= 0) {
    return {
      chartType: "scatter",
      xAxisIndex: firstNumericIndex,
      yAxisIndices: [secondNumericIndex],
      reason: `Multiple numeric columns were found, so a scatter plot is the safest default for exploring relationships.`,
    };
  }

  if (first && firstNumericIndex >= 1) {
    return {
      chartType: "line",
      xAxisIndex: 0,
      yAxisIndices: [firstNumericIndex],
      reason: `No strong chart pattern was detected, so a line chart using the first column as x and the first numeric column as y is the most useful fallback.`,
    };
  }

  const fallbackY = firstNumericIndex >= 0 ? firstNumericIndex : Math.min(1, Math.max(0, columns.length - 1));
  return {
    chartType: "line",
    xAxisIndex: 0,
    yAxisIndices: fallbackY >= 0 ? [fallbackY] : [],
    reason: `No strong chart pattern was detected, so a line chart is used as the most broadly useful default.`,
  };
}

export function buildAutoInsightText(
  profile: DatasetProfile,
  recommendation: VisualizationRecommendation,
): string {
  const warning = profile.warnings[0];
  const chartName = CHART_LABELS[recommendation.chartType];
  const summary = `${chartName} recommended. ${recommendation.reason}`;
  return warning ? `${summary} Warning: ${warning}` : summary;
}
