import type { ParsedData } from "@/lib/chartEngine";
import type { InferredColumn } from "@/lib/analysisEngine";

export interface NumericProfile {
  index: number;
  name: string;
  count: number;
  missingRate: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  std: number;
}

export interface CategoricalProfile {
  index: number;
  name: string;
  uniqueCount: number;
  missingRate: number;
  topValues: Array<{ label: string; count: number }>;
}

export interface CorrelationProfile {
  leftIndex: number;
  rightIndex: number;
  leftName: string;
  rightName: string;
  value: number;
}

export interface ProfilingSummary {
  rowCount: number;
  columnCount: number;
  missingCells: number;
  missingRate: number;
  duplicateRows: number;
  duplicateRate: number;
  constantColumns: number;
  numericProfiles: NumericProfile[];
  categoricalProfiles: CategoricalProfile[];
  correlations: CorrelationProfile[];
}

function isMissing(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim() === "");
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const fraction = position - base;
  const lower = sorted[base] ?? sorted[sorted.length - 1];
  const upper = sorted[base + 1] ?? lower;
  return lower + (upper - lower) * fraction;
}

function pearson(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 3) return null;
  const n = xs.length;
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n;
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  for (let i = 0; i < n; i += 1) {
    const dx = xs[i] - meanX;
    const dy = ys[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  if (denomX <= 0 || denomY <= 0) return null;
  return numerator / Math.sqrt(denomX * denomY);
}

export function buildProfilingSummary(data: ParsedData, inferredColumns: InferredColumn[]): ProfilingSummary {
  const rowCount = data.rows.length;
  const columnCount = data.headers.length;
  const totalCells = rowCount * Math.max(columnCount, 1);

  let missingCells = 0;
  data.rows.forEach((row) => {
    for (let i = 0; i < columnCount; i += 1) {
      if (isMissing(row[i])) missingCells += 1;
    }
  });

  const rowKeys = data.rows.map((row) => JSON.stringify(row));
  const duplicateRows = rowKeys.length - new Set(rowKeys).size;

  let constantColumns = 0;
  inferredColumns.forEach((column) => {
    const values = data.rows
      .map((row) => row[column.index])
      .filter((value) => !isMissing(value))
      .map((value) => String(value));
    if (!values.length || new Set(values).size <= 1) constantColumns += 1;
  });

  const numericProfiles: NumericProfile[] = inferredColumns
    .filter((column) => column.type === "number")
    .map((column) => {
      const numbers = data.rows
        .map((row) => toFiniteNumber(row[column.index]))
        .filter((value): value is number => value != null);
      const sorted = [...numbers].sort((a, b) => a - b);
      const count = sorted.length;
      const mean = count ? sorted.reduce((sum, value) => sum + value, 0) / count : 0;
      const variance = count ? sorted.reduce((sum, value) => sum + (value - mean) ** 2, 0) / count : 0;

      return {
        index: column.index,
        name: column.name,
        count,
        missingRate: rowCount > 0 ? (rowCount - count) / rowCount : 0,
        min: count ? sorted[0] : 0,
        max: count ? sorted[sorted.length - 1] : 0,
        mean,
        median: quantile(sorted, 0.5),
        std: Math.sqrt(variance),
      };
    })
    .sort((a, b) => b.count - a.count);

  const categoricalProfiles: CategoricalProfile[] = inferredColumns
    .filter((column) => column.type === "category" || column.type === "datetime")
    .map((column) => {
      const values = data.rows.map((row) => row[column.index]);
      const bucket = new Map<string, number>();
      let nonMissingCount = 0;
      values.forEach((value) => {
        if (isMissing(value)) return;
        nonMissingCount += 1;
        const key = String(value);
        bucket.set(key, (bucket.get(key) ?? 0) + 1);
      });
      const topValues = Array.from(bucket.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([label, count]) => ({ label, count }));

      return {
        index: column.index,
        name: column.name,
        uniqueCount: bucket.size,
        missingRate: rowCount > 0 ? (rowCount - nonMissingCount) / rowCount : 0,
        topValues,
      };
    })
    .sort((a, b) => b.uniqueCount - a.uniqueCount);

  const numericIndexes = inferredColumns.filter((column) => column.type === "number").map((column) => column.index);
  const correlations: CorrelationProfile[] = [];

  for (let i = 0; i < numericIndexes.length; i += 1) {
    for (let j = i + 1; j < numericIndexes.length; j += 1) {
      const leftIndex = numericIndexes[i];
      const rightIndex = numericIndexes[j];
      const leftValues: number[] = [];
      const rightValues: number[] = [];

      data.rows.forEach((row) => {
        const left = toFiniteNumber(row[leftIndex]);
        const right = toFiniteNumber(row[rightIndex]);
        if (left == null || right == null) return;
        leftValues.push(left);
        rightValues.push(right);
      });

      const value = pearson(leftValues, rightValues);
      if (value == null) continue;
      correlations.push({
        leftIndex,
        rightIndex,
        leftName: data.headers[leftIndex] ?? `col_${leftIndex + 1}`,
        rightName: data.headers[rightIndex] ?? `col_${rightIndex + 1}`,
        value,
      });
    }
  }

  correlations.sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return {
    rowCount,
    columnCount,
    missingCells,
    missingRate: totalCells > 0 ? missingCells / totalCells : 0,
    duplicateRows,
    duplicateRate: rowCount > 0 ? duplicateRows / rowCount : 0,
    constantColumns,
    numericProfiles,
    categoricalProfiles,
    correlations,
  };
}
