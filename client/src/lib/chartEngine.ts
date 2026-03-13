import type { EChartsOption } from "echarts";
import type { ChartConfig, ChartType } from "@shared/schema";
import { NATURE_COLORS } from "@shared/schema";

export interface ParsedData {
  headers: string[];
  rows: (string | number)[][];
}

export type ColumnType = "numeric" | "categorical";

export function detectColumnTypes(data: ParsedData): ColumnType[] {
  return data.headers.map((_, colIdx) => {
    // Check first 20 rows to determine type
    const sampleSize = Math.min(data.rows.length, 20);
    let numericCount = 0;
    for (let i = 0; i < sampleSize; i++) {
        if (isNumeric(data.rows[i][colIdx])) numericCount++;
    }
    return numericCount / sampleSize > 0.8 ? "numeric" : "categorical";
  });
}

export function recommendChartType(columnTypes: ColumnType[], config: ChartConfig): ChartType[] {
    const xType = columnTypes[config.xAxisColumn];
    const yIndices = config.selectedColumns || [];
    const yTypes = yIndices.map(i => columnTypes[i]);
    
    const numY = yTypes.filter(t => t === "numeric").length;
    const catY = yTypes.filter(t => t === "categorical").length;

    if (yIndices.length === 0) return [];

    const recs: ChartType[] = [];

    // Logic based on selection
    if (xType === "categorical") {
        if (numY >= 1) recs.push("bar");
        if (numY === 1) recs.push("pie");
        if (numY > 1) recs.push("line"); // Multi-series bar/line
    } else {
        // Numeric X (e.g. Time or Value)
        if (numY >= 1) recs.push("line", "scatter");
        if (numY >= 1) recs.push("area");
    }

    // Special combinations
    if (numY >= 3) recs.push("boxplot", "violin");
    if (catY >= 3 && xType === "categorical") recs.push("radar");
    if (numY >= 2 && xType === "numeric") recs.push("heatmap");

    // Filter duplicates and return
    return Array.from(new Set(recs));
}

// Filter data to only include selected columns
function filterColumns(data: ParsedData, config: ChartConfig): ParsedData {
  const xCol = config.xAxisColumn ?? 0;
  const yCols = config.selectedColumns || [];
  
  // If no columns selected, return just the X column
  if (yCols.length === 0) {
    return { 
      headers: [data.headers[xCol]], 
      rows: data.rows.map(r => [r[xCol]]) 
    };
  }

  // Combine X column with selected Y columns (filtering out X if it was accidentally in Y)
  const indices = [xCol, ...yCols.filter(i => i !== xCol && i < data.headers.length)];
  
  return {
    headers: indices.map((i) => data.headers[i]),
    rows: data.rows.map((r) => indices.map((i) => r[i])),
  };
}

// Sort data rows for bar charts
function sortRows(data: ParsedData, sortData: string): ParsedData {
  if (sortData === "none") return data;
  const sorted = [...data.rows].sort((a, b) => {
    const va = isNumeric(a[1]) ? toNumber(a[1]) : 0;
    const vb = isNumeric(b[1]) ? toNumber(b[1]) : 0;
    return sortData === "asc" ? va - vb : vb - va;
  });
  return { headers: data.headers, rows: sorted };
}

// Data label config helper
function labelConfig(config: ChartConfig, position: string = "top"): object {
  return {
    show: config.showDataLabels,
    fontSize: config.fontSize - 3,
    fontFamily: config.fontFamily,
    position,
    color: config.backgroundColor !== "#ffffff" ? "#ccc" : "#555",
  };
}

// Reference line markLine helper
function referenceMarkLine(config: ChartConfig, axis: "yAxis" | "xAxis" = "yAxis"): object | undefined {
  if (config.referenceLine == null) return undefined;
  return {
    silent: true,
    symbol: "none",
    lineStyle: { type: "dashed" as const, color: "#C75C2F", width: 1.5 },
    label: {
      formatter: config.referenceLineLabel || String(config.referenceLine),
      fontSize: config.fontSize - 3,
      color: config.backgroundColor !== "#ffffff" ? "#ddd" : "#444",
    },
    data: [{ [axis]: config.referenceLine }],
  };
}

// DataZoom config helper
function dataZoomConfig(config: ChartConfig): object[] | undefined {
  if (!config.showDataZoom) return undefined;
  const isDark = config.backgroundColor !== "#ffffff";
  return [
    { type: "inside" as const, start: 0, end: 100 },
    {
      type: "slider" as const,
      start: 0,
      end: 100,
      height: 18,
      bottom: 6,
      borderColor: isDark ? "#444" : "#ddd",
      backgroundColor: isDark ? "#2a2a2e" : "#f5f5f5",
      fillerColor: isDark ? "rgba(78,148,163,0.25)" : "rgba(46,107,138,0.15)",
      handleStyle: { color: isDark ? "#4F98A3" : "#2E6B8A" },
    },
  ];
}

// Nature-style base theme
function getBaseOption(config: ChartConfig): EChartsOption {
  const isDark = config.backgroundColor !== "#ffffff";
  const textColor = isDark ? "#D4D4D8" : "#333333";
  const axisLineColor = isDark ? "#555" : "#333";
  const splitLineColor = isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  return {
    backgroundColor: "transparent",
    title: config.title
      ? {
          text: config.title,
          left: "center",
          top: 12,
          textStyle: {
            fontSize: config.fontSize + 2,
            fontWeight: 600,
            fontFamily: config.fontFamily,
            color: textColor,
          },
        }
      : undefined,
    grid: {
      left: 72,
      right: 32,
      top: config.title ? 56 : 32,
      bottom: (config.xAxisLabel ? 60 : 44) + (config.showDataZoom ? 36 : 0),
      containLabel: false,
    },
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: isDark ? "#2a2a2e" : "#fff",
      borderColor: isDark ? "#444" : "#e5e5e5",
      textStyle: {
        fontSize: 12,
        fontFamily: config.fontFamily,
        color: textColor,
      },
      extraCssText: "box-shadow: 0 2px 8px rgba(0,0,0,0.12); border-radius: 6px;",
    },
    legend: config.showLegend
      ? {
          top: config.title ? 36 : 8,
          textStyle: {
            fontSize: config.fontSize - 2,
            fontFamily: config.fontFamily,
            color: isDark ? "#aaa" : "#666",
          },
          itemWidth: 16,
          itemHeight: 10,
          itemGap: 16,
        }
      : undefined,
    color: config.colors.length ? config.colors : NATURE_COLORS,
    textStyle: {
      fontFamily: config.fontFamily,
      color: textColor,
    },
    xAxis: {
      nameTextStyle: {
        fontSize: config.fontSize - 1,
        fontFamily: config.fontFamily,
        color: isDark ? "#999" : "#555",
        padding: [8, 0, 0, 0],
      },
      axisLabel: {
        fontSize: config.fontSize - 2,
        fontFamily: config.fontFamily,
        color: isDark ? "#999" : "#555",
      },
      axisLine: {
        lineStyle: { color: axisLineColor, width: 1.2 },
      },
      axisTick: {
        lineStyle: { color: axisLineColor },
        length: 4,
      },
      splitLine: {
        show: config.showGrid,
        lineStyle: { color: splitLineColor, type: "dashed" as const },
      },
    },
    yAxis: {
      nameTextStyle: {
        fontSize: config.fontSize - 1,
        fontFamily: config.fontFamily,
        color: isDark ? "#999" : "#555",
        padding: [0, 8, 0, 0],
      },
      axisLabel: {
        fontSize: config.fontSize - 2,
        fontFamily: config.fontFamily,
        color: isDark ? "#999" : "#555",
      },
      axisLine: {
        show: true,
        lineStyle: { color: axisLineColor, width: 1.2 },
      },
      axisTick: {
        show: true,
        lineStyle: { color: axisLineColor },
        length: 4,
      },
      splitLine: {
        show: config.showGrid,
        lineStyle: { color: splitLineColor, type: "dashed" as const },
      },
    },
    animationDuration: 600,
    animationEasing: "cubicOut" as const,
  };
}

function isNumeric(val: unknown): boolean {
  if (typeof val === "number") return true;
  if (typeof val === "string") return val.trim() !== "" && !isNaN(Number(val));
  return false;
}

function toNumber(val: unknown): number {
  return typeof val === "number" ? val : Number(val);
}

export function buildLineChart(data: ParsedData, config: ChartConfig): EChartsOption {
  const base = getBaseOption(config);
  const xData = data.rows.map((r) => r[0]);
  const markLine = referenceMarkLine(config);
  const series = data.headers.slice(1).map((name, i) => ({
    name,
    type: "line" as const,
    data: data.rows.map((r) => (isNumeric(r[i + 1]) ? toNumber(r[i + 1]) : null)),
    smooth: config.smooth,
    showSymbol: config.showSymbol,
    symbolSize: config.symbolSize,
    lineStyle: { width: config.lineWidth },
    label: labelConfig(config),
    stack: config.stacked ? "total" : undefined,
    ...(i === 0 && markLine ? { markLine } : {}),
  }));

  return {
    ...base,
    xAxis: {
      ...(base.xAxis as object),
      type: "category" as const,
      data: xData,
      name: config.xAxisLabel,
      boundaryGap: false,
    },
    yAxis: {
      ...(base.yAxis as object),
      type: "value" as const,
      name: config.yAxisLabel,
    },
    dataZoom: dataZoomConfig(config),
    series,
  };
}

export function buildScatterChart(data: ParsedData, config: ChartConfig): EChartsOption {
  const base = getBaseOption(config);
  const markLine = referenceMarkLine(config);

  const series = data.headers.slice(1).map((name, i) => ({
    name,
    type: "scatter" as const,
    data: data.rows
      .filter((r) => isNumeric(r[0]) && isNumeric(r[i + 1]))
      .map((r) => [toNumber(r[0]), toNumber(r[i + 1])]),
    symbolSize: config.symbolSize + 2,
    label: labelConfig(config),
    ...(i === 0 && markLine ? { markLine } : {}),
  }));

  return {
    ...base,
    tooltip: {
      ...(base.tooltip as object),
      trigger: "item" as const,
    },
    xAxis: {
      ...(base.xAxis as object),
      type: "value" as const,
      name: config.xAxisLabel,
    },
    yAxis: {
      ...(base.yAxis as object),
      type: "value" as const,
      name: config.yAxisLabel,
    },
    dataZoom: dataZoomConfig(config),
    series,
  };
}

export function buildBarChart(data: ParsedData, config: ChartConfig): EChartsOption {
  const base = getBaseOption(config);
  const sorted = sortRows(data, config.sortData);
  const xData = sorted.rows.map((r) => r[0]);
  const markLine = referenceMarkLine(config);
  const series = sorted.headers.slice(1).map((name, i) => ({
    name,
    type: "bar" as const,
    data: sorted.rows.map((r) => (isNumeric(r[i + 1]) ? toNumber(r[i + 1]) : 0)),
    barWidth: config.barWidth,
    itemStyle: { borderRadius: config.stacked ? [0, 0, 0, 0] : [3, 3, 0, 0] },
    label: labelConfig(config),
    stack: config.stacked ? "total" : undefined,
    ...(i === 0 && markLine ? { markLine } : {}),
  }));

  return {
    ...base,
    xAxis: {
      ...(base.xAxis as object),
      type: "category" as const,
      data: xData,
      name: config.xAxisLabel,
    },
    yAxis: {
      ...(base.yAxis as object),
      type: "value" as const,
      name: config.yAxisLabel,
    },
    dataZoom: dataZoomConfig(config),
    series,
  };
}

export function buildBarHChart(data: ParsedData, config: ChartConfig): EChartsOption {
  const base = getBaseOption(config);
  const sorted = sortRows(data, config.sortData);
  const yData = sorted.rows.map((r) => r[0]);
  const markLine = referenceMarkLine(config, "xAxis");
  const series = sorted.headers.slice(1).map((name, i) => ({
    name,
    type: "bar" as const,
    data: sorted.rows.map((r) => (isNumeric(r[i + 1]) ? toNumber(r[i + 1]) : 0)),
    barWidth: config.barWidth,
    itemStyle: { borderRadius: config.stacked ? [0, 0, 0, 0] : [0, 3, 3, 0] },
    label: labelConfig(config, "right"),
    stack: config.stacked ? "total" : undefined,
    ...(i === 0 && markLine ? { markLine } : {}),
  }));

  return {
    ...base,
    grid: {
      ...(base.grid as object),
      left: 100,
    },
    xAxis: {
      ...(base.xAxis as object),
      type: "value" as const,
      name: config.xAxisLabel,
    },
    yAxis: {
      ...(base.yAxis as object),
      type: "category" as const,
      data: yData,
      name: config.yAxisLabel,
      inverse: true,
    },
    series,
  };
}

export function buildHeatmapChart(data: ParsedData, config: ChartConfig): EChartsOption {
  const base = getBaseOption(config);
  const isDark = config.backgroundColor !== "#ffffff";

  // Data format: first col = y labels, first row (headers[1:]) = x labels
  const xLabels = data.headers.slice(1);
  const yLabels = data.rows.map((r) => String(r[0]));
  const heatmapData: [number, number, number][] = [];
  let minVal = Infinity;
  let maxVal = -Infinity;

  data.rows.forEach((row, yi) => {
    row.slice(1).forEach((val, xi) => {
      const numVal = isNumeric(val) ? toNumber(val) : 0;
      heatmapData.push([xi, yi, numVal]);
      if (numVal < minVal) minVal = numVal;
      if (numVal > maxVal) maxVal = numVal;
    });
  });

  return {
    ...base,
    grid: {
      ...(base.grid as object),
      bottom: 72,
    },
    tooltip: {
      ...(base.tooltip as object),
      trigger: "item" as const,
      formatter: (params: any) => {
        const d = params.data;
        return `${xLabels[d[0]]} × ${yLabels[d[1]]}: <strong>${d[2]}</strong>`;
      },
    },
    xAxis: {
      ...(base.xAxis as object),
      type: "category" as const,
      data: xLabels,
      name: config.xAxisLabel,
      splitArea: { show: true },
    },
    yAxis: {
      ...(base.yAxis as object),
      type: "category" as const,
      data: yLabels,
      name: config.yAxisLabel,
      splitArea: { show: true },
    },
    visualMap: {
      min: config.heatmapMin ?? minVal,
      max: config.heatmapMax ?? maxVal,
      calculable: true,
      orient: "horizontal" as const,
      left: "center",
      bottom: 10,
      inRange: {
        color: isDark
          ? ["#1a2940", "#2E6B8A", "#D4A84B", "#C75C2F"]
          : ["#f0f4f8", "#5B9BD5", "#FFC553", "#C75C2F"],
      },
      textStyle: {
        color: isDark ? "#999" : "#555",
        fontSize: config.fontSize - 3,
      },
    },
    series: [
      {
        type: "heatmap" as const,
        data: heatmapData,
        label: {
          show: heatmapData.length <= 200,
          fontSize: config.fontSize - 4,
          color: isDark ? "#ccc" : "#333",
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 6,
            shadowColor: "rgba(0, 0, 0, 0.2)",
          },
        },
      },
    ],
  };
}

export function buildBoxplotChart(data: ParsedData, config: ChartConfig): EChartsOption {
  const base = getBaseOption(config);

  // Data format: each column is a group, rows are individual data points
  const categories = data.headers.slice(0);
  const rawGroups: number[][] = categories.map(() => []);

  data.rows.forEach((row) => {
    row.forEach((val, ci) => {
      if (isNumeric(val)) {
        rawGroups[ci].push(toNumber(val));
      }
    });
  });

  // Calculate boxplot stats for each group
  function calcStats(arr: number[]): [number, number, number, number, number] {
    const sorted = [...arr].sort((a, b) => a - b);
    const n = sorted.length;
    if (n === 0) return [0, 0, 0, 0, 0];
    const q1 = sorted[Math.floor(n * 0.25)];
    const q2 = sorted[Math.floor(n * 0.5)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const lw = sorted.find((v) => v >= q1 - 1.5 * iqr) ?? sorted[0];
    const uw = [...sorted].reverse().find((v) => v <= q3 + 1.5 * iqr) ?? sorted[n - 1];
    return [lw, q1, q2, q3, uw];
  }

  const boxData = rawGroups.map((g) => calcStats(g));
  // Outliers
  const outliers: [number, number][] = [];
  rawGroups.forEach((group, gi) => {
    const [lw, , , , uw] = boxData[gi];
    group.forEach((v) => {
      if (v < lw || v > uw) outliers.push([gi, v]);
    });
  });

  return {
    ...base,
    tooltip: {
      ...(base.tooltip as object),
      trigger: "item" as const,
    },
    xAxis: {
      ...(base.xAxis as object),
      type: "category" as const,
      data: categories,
      name: config.xAxisLabel,
    },
    yAxis: {
      ...(base.yAxis as object),
      type: "value" as const,
      name: config.yAxisLabel,
    },
    series: [
      {
        type: "boxplot" as const,
        data: boxData,
        itemStyle: {
          borderWidth: 1.5,
        },
      },
      ...(outliers.length > 0
        ? [
            {
              type: "scatter" as const,
              data: outliers,
              symbolSize: 5,
              itemStyle: { color: "#C75C2F" },
            },
          ]
        : []),
    ],
  };
}

export function buildAreaChart(data: ParsedData, config: ChartConfig): EChartsOption {
  const base = getBaseOption(config);
  const xData = data.rows.map((r) => r[0]);
  const markLine = referenceMarkLine(config);
  const series = data.headers.slice(1).map((name, i) => ({
    name,
    type: "line" as const,
    data: data.rows.map((r) => (isNumeric(r[i + 1]) ? toNumber(r[i + 1]) : null)),
    smooth: config.smooth,
    showSymbol: config.showSymbol,
    symbolSize: config.symbolSize,
    lineStyle: { width: config.lineWidth },
    areaStyle: { opacity: config.areaOpacity ?? 0.35 },
    label: labelConfig(config),
    stack: config.stacked ? "total" : undefined,
    ...(i === 0 && markLine ? { markLine } : {}),
  }));

  return {
    ...base,
    xAxis: {
      ...(base.xAxis as object),
      type: "category" as const,
      data: xData,
      name: config.xAxisLabel,
      boundaryGap: false,
    },
    yAxis: {
      ...(base.yAxis as object),
      type: "value" as const,
      name: config.yAxisLabel,
    },
    dataZoom: dataZoomConfig(config),
    series,
  };
}

export function buildPieChart(data: ParsedData, config: ChartConfig): EChartsOption {
  const base = getBaseOption(config);
  const isDark = config.backgroundColor !== "#ffffff";
  const textColor = isDark ? "#D4D4D8" : "#333333";

  // Data: first col = labels, second col = values
  const pieData = data.rows.map((r) => ({
    name: String(r[0]),
    value: isNumeric(r[1]) ? toNumber(r[1]) : 0,
  }));

  const radius: [string, string] = config.pieDonut ? ["40%", "70%"] : ["0%", "70%"];

  return {
    ...base,
    tooltip: {
      ...(base.tooltip as object),
      trigger: "item" as const,
      formatter: "{b}: {c} ({d}%)",
    },
    xAxis: undefined as any,
    yAxis: undefined as any,
    series: [
      {
        type: "pie" as const,
        radius,
        center: ["50%", "55%"],
        roseType: config.pieRoseType ? ("area" as const) : undefined,
        data: pieData,
        label: {
          fontSize: config.fontSize - 2,
          fontFamily: config.fontFamily,
          color: textColor,
          formatter: "{b}\n{d}%",
        },
        labelLine: {
          length: 16,
          length2: 8,
        },
        itemStyle: {
          borderRadius: 4,
          borderColor: isDark ? "#1e1e22" : "#fff",
          borderWidth: 2,
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: "rgba(0, 0, 0, 0.15)",
          },
        },
      },
    ],
  };
}

export function buildRadarChart(data: ParsedData, config: ChartConfig): EChartsOption {
  const base = getBaseOption(config);
  const isDark = config.backgroundColor !== "#ffffff";

  // First col = dimension names, remaining cols = series data
  // OR: first row headers[1:] = series names, first col = indicators
  const indicators = data.rows.map((r) => {
    const vals = r.slice(1).map((v) => (isNumeric(v) ? toNumber(v) : 0));
    return {
      name: String(r[0]),
      max: Math.ceil(Math.max(...vals) * 1.3),
    };
  });

  const seriesData = data.headers.slice(1).map((name, i) => ({
    name,
    value: data.rows.map((r) => (isNumeric(r[i + 1]) ? toNumber(r[i + 1]) : 0)),
    areaStyle: { opacity: 0.15 },
    lineStyle: { width: config.lineWidth },
    symbolSize: config.symbolSize,
  }));

  return {
    ...base,
    xAxis: undefined as any,
    yAxis: undefined as any,
    radar: {
      indicator: indicators,
      shape: "polygon" as const,
      splitNumber: 4,
      axisName: {
        color: isDark ? "#aaa" : "#555",
        fontSize: config.fontSize - 2,
        fontFamily: config.fontFamily,
      },
      splitLine: {
        lineStyle: { color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)" },
      },
      splitArea: {
        show: true,
        areaStyle: {
          color: isDark
            ? ["rgba(255,255,255,0.02)", "rgba(255,255,255,0.04)"]
            : ["rgba(0,0,0,0.01)", "rgba(0,0,0,0.03)"],
        },
      },
      axisLine: {
        lineStyle: { color: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)" },
      },
    },
    series: [
      {
        type: "radar" as const,
        data: seriesData,
      },
    ],
  };
}

export function buildViolinChart(data: ParsedData, config: ChartConfig): EChartsOption {
  const base = getBaseOption(config);
  const isDark = config.backgroundColor !== "#ffffff";
  const colors = config.colors.length ? config.colors : NATURE_COLORS;

  const categories = data.headers.slice(0);
  const rawGroups: number[][] = categories.map(() => []);

  data.rows.forEach((row) => {
    row.forEach((val, ci) => {
      if (isNumeric(val)) {
        rawGroups[ci].push(toNumber(val));
      }
    });
  });

  // Kernel density estimation (Gaussian)
  function kde(values: number[], bandwidth: number, nPoints: number = 50): { x: number; y: number }[] {
    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0] - bandwidth * 2;
    const max = sorted[sorted.length - 1] + bandwidth * 2;
    const step = (max - min) / (nPoints - 1);
    const points: { x: number; y: number }[] = [];
    for (let i = 0; i < nPoints; i++) {
      const x = min + i * step;
      let density = 0;
      for (const v of values) {
        const z = (x - v) / bandwidth;
        density += Math.exp(-0.5 * z * z) / (bandwidth * Math.sqrt(2 * Math.PI));
      }
      density /= values.length;
      points.push({ x, y: density });
    }
    return points;
  }

  // Scott's rule for bandwidth
  function scottBandwidth(values: number[]): number {
    const n = values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(n * 0.25)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - values.reduce((a, b) => a + b, 0) / n) ** 2, 0) / n);
    const h = 1.06 * Math.min(std, iqr / 1.34) * Math.pow(n, -0.2);
    return Math.max(h, 0.1);
  }

  const allSeries: any[] = [];

  rawGroups.forEach((group, gi) => {
    if (group.length < 3) return;
    const bw = scottBandwidth(group);
    const density = kde(group, bw, 40);
    const maxDensity = Math.max(...density.map((d) => d.y));
    const halfWidth = 0.38;

    // Left and right halves of the violin
    const leftPoints = density.map((d) => [
      gi - (d.y / maxDensity) * halfWidth,
      d.x,
    ]);
    const rightPoints = density.map((d) => [
      gi + (d.y / maxDensity) * halfWidth,
      d.x,
    ]);

    // Create a closed polygon
    const polygonData = [...leftPoints, ...rightPoints.reverse()];

    allSeries.push({
      type: "custom" as const,
      renderItem: (_params: any, api: any) => {
        const points = polygonData.map((p) => {
          const x = api.coord([p[0], p[1]]);
          return x;
        });
        return {
          type: "polygon",
          shape: { points },
          style: {
            fill: colors[gi % colors.length],
            opacity: 0.6,
            stroke: colors[gi % colors.length],
            lineWidth: 1.5,
          },
        };
      },
      data: polygonData,
      z: 1,
    });

    // Add boxplot overlay
    const sorted = [...group].sort((a, b) => a - b);
    const n = sorted.length;
    const q1 = sorted[Math.floor(n * 0.25)];
    const median = sorted[Math.floor(n * 0.5)];
    const q3 = sorted[Math.floor(n * 0.75)];

    // Box
    allSeries.push({
      type: "custom" as const,
      renderItem: (_params: any, api: any) => {
        const boxW = 12;
        const topLeft = api.coord([gi, q3]);
        const bottomRight = api.coord([gi, q1]);
        const medianPt = api.coord([gi, median]);
        return {
          type: "group",
          children: [
            {
              type: "rect",
              shape: {
                x: topLeft[0] - boxW / 2,
                y: topLeft[1],
                width: boxW,
                height: bottomRight[1] - topLeft[1],
              },
              style: {
                fill: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.08)",
                stroke: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)",
                lineWidth: 1,
              },
            },
            {
              type: "line",
              shape: {
                x1: medianPt[0] - boxW / 2,
                y1: medianPt[1],
                x2: medianPt[0] + boxW / 2,
                y2: medianPt[1],
              },
              style: {
                stroke: isDark ? "#fff" : "#333",
                lineWidth: 2,
              },
            },
          ],
        };
      },
      data: [[gi, q1, median, q3]],
      z: 2,
    });
  });

  return {
    ...base,
    tooltip: {
      ...(base.tooltip as object),
      trigger: "item" as const,
      formatter: (params: any) => {
        const idx = params.seriesIndex;
        const groupIdx = Math.floor(idx / 2);
        if (groupIdx < categories.length) {
          const group = rawGroups[groupIdx];
          if (!group || group.length === 0) return "";
          const sorted = [...group].sort((a, b) => a - b);
          const n = sorted.length;
          const mean = (group.reduce((a, b) => a + b, 0) / n).toFixed(2);
          const median = sorted[Math.floor(n * 0.5)].toFixed(2);
          return `<strong>${categories[groupIdx]}</strong><br/>N=${n}<br/>Mean: ${mean}<br/>Median: ${median}`;
        }
        return "";
      },
    },
    xAxis: {
      ...(base.xAxis as object),
      type: "value" as const,
      min: -0.5,
      max: categories.length - 0.5,
      axisLabel: {
        ...(base.xAxis as any)?.axisLabel,
        formatter: (val: number) => {
          const idx = Math.round(val);
          return idx >= 0 && idx < categories.length ? categories[idx] : "";
        },
        interval: 0,
      },
      name: config.xAxisLabel,
      splitLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      ...(base.yAxis as object),
      type: "value" as const,
      name: config.yAxisLabel,
    },
    series: allSeries,
  };
}

export function buildChart(
  chartType: ChartType,
  rawData: ParsedData,
  config: ChartConfig,
): EChartsOption {
  const data = filterColumns(rawData, config);
  switch (chartType) {
    case "line":
      return buildLineChart(data, config);
    case "scatter":
      return buildScatterChart(data, config);
    case "bar":
      return buildBarChart(data, config);
    case "barH":
      return buildBarHChart(data, config);
    case "area":
      return buildAreaChart(data, config);
    case "pie":
      return buildPieChart(data, config);
    case "radar":
      return buildRadarChart(data, config);
    case "heatmap":
      return buildHeatmapChart(data, config);
    case "boxplot":
      return buildBoxplotChart(data, config);
    case "violin":
      return buildViolinChart(data, config);
    default:
      return buildLineChart(data, config);
  }
}

// Generate sample data for each chart type
export function getSampleData(chartType: ChartType): ParsedData {
  switch (chartType) {
    case "line":
      return {
        headers: ["Time (h)", "Control", "Treatment A", "Treatment B"],
        rows: [
          [0, 1.0, 1.0, 1.0],
          [2, 1.8, 2.3, 1.5],
          [4, 3.2, 4.8, 2.1],
          [6, 4.1, 7.2, 2.8],
          [8, 4.8, 9.6, 3.4],
          [12, 5.2, 12.1, 4.0],
          [24, 5.5, 14.3, 4.5],
        ],
      };
    case "scatter":
      return {
        headers: ["Concentration (μM)", "Response A", "Response B"],
        rows: [
          [0.1, 2.3, 1.8],
          [0.5, 5.1, 3.2],
          [1.0, 8.7, 5.5],
          [2.0, 14.2, 7.8],
          [5.0, 22.1, 11.3],
          [10.0, 28.5, 14.6],
          [20.0, 31.2, 17.2],
          [50.0, 33.8, 19.0],
          [0.2, 3.1, 2.4],
          [0.8, 6.9, 4.1],
          [1.5, 11.3, 6.5],
          [3.0, 18.0, 9.2],
          [8.0, 26.3, 13.1],
          [15.0, 30.1, 16.0],
          [30.0, 32.5, 18.1],
        ],
      };
    case "bar":
      return {
        headers: ["Gene", "Wild Type", "Knockout"],
        rows: [
          ["BRCA1", 12.4, 3.2],
          ["TP53", 8.7, 15.3],
          ["EGFR", 6.1, 11.8],
          ["KRAS", 4.3, 9.5],
          ["MYC", 15.2, 7.1],
        ],
      };
    case "barH":
      return {
        headers: ["Pathway", "Enrichment Score"],
        rows: [
          ["Cell cycle", 4.8],
          ["Apoptosis", 3.9],
          ["DNA repair", 3.5],
          ["Signal transduction", 3.1],
          ["Metabolism", 2.7],
          ["Immune response", 2.3],
          ["Angiogenesis", 1.9],
        ],
      };
    case "heatmap":
      return {
        headers: ["Gene", "Sample 1", "Sample 2", "Sample 3", "Sample 4", "Sample 5"],
        rows: [
          ["ACTB", 2.1, 1.8, 2.3, 1.9, 2.0],
          ["GAPDH", 1.5, 3.2, 0.8, 2.7, 1.1],
          ["TP53", -1.2, 0.5, -0.8, 1.3, -0.3],
          ["BRCA1", 0.3, -1.5, 2.1, -0.7, 1.8],
          ["EGFR", -0.8, 1.2, -1.5, 0.9, 2.3],
          ["MYC", 1.7, -0.3, 1.2, -1.1, 0.5],
        ],
      };
    case "boxplot":
      return {
        headers: ["Control", "Drug A", "Drug B", "Drug C"],
        rows: [
          [12.3, 18.5, 15.2, 22.1],
          [14.1, 20.3, 14.8, 24.5],
          [11.8, 17.2, 16.1, 21.3],
          [13.5, 19.8, 13.9, 23.8],
          [12.9, 21.5, 15.7, 25.2],
          [15.2, 16.8, 14.3, 20.7],
          [11.5, 22.1, 16.8, 26.1],
          [14.7, 18.9, 15.0, 22.9],
          [13.1, 20.7, 14.5, 24.1],
          [12.6, 19.4, 15.4, 23.5],
          [10.2, 23.8, 13.1, 27.3],
          [16.1, 15.9, 17.2, 19.5],
        ],
      };
    case "area":
      return {
        headers: ["Month", "CO₂ (ppm)", "CH₄ (ppb)"],
        rows: [
          ["Jan", 415.2, 1892],
          ["Feb", 416.0, 1898],
          ["Mar", 417.1, 1905],
          ["Apr", 418.3, 1912],
          ["May", 419.8, 1920],
          ["Jun", 418.9, 1916],
          ["Jul", 417.5, 1908],
          ["Aug", 415.8, 1895],
          ["Sep", 414.2, 1888],
          ["Oct", 415.6, 1900],
          ["Nov", 417.3, 1910],
          ["Dec", 418.5, 1918],
        ],
      };
    case "pie":
      return {
        headers: ["Category", "Value"],
        rows: [
          ["Protein Coding", 20345],
          ["lncRNA", 16849],
          ["Pseudogene", 14723],
          ["miRNA", 1881],
          ["snRNA", 1901],
          ["Other", 4382],
        ],
      };
    case "radar":
      return {
        headers: ["Indicator", "Compound A", "Compound B", "Compound C"],
        rows: [
          ["Efficacy", 85, 72, 91],
          ["Selectivity", 78, 90, 65],
          ["Bioavailability", 62, 85, 73],
          ["Half-life", 91, 60, 82],
          ["Solubility", 55, 78, 88],
          ["Toxicity (inv.)", 88, 70, 60],
        ],
      };
    case "violin":
      return {
        headers: ["Control", "Drug A", "Drug B", "Drug C"],
        rows: [
          [12.3, 18.5, 15.2, 22.1],
          [14.1, 20.3, 14.8, 24.5],
          [11.8, 17.2, 16.1, 21.3],
          [13.5, 19.8, 13.9, 23.8],
          [12.9, 21.5, 15.7, 25.2],
          [15.2, 16.8, 14.3, 20.7],
          [11.5, 22.1, 16.8, 26.1],
          [14.7, 18.9, 15.0, 22.9],
          [13.1, 20.7, 14.5, 24.1],
          [12.6, 19.4, 15.4, 23.5],
          [10.2, 23.8, 13.1, 27.3],
          [16.1, 15.9, 17.2, 19.5],
          [13.8, 17.6, 15.9, 23.0],
          [12.0, 20.1, 14.2, 25.8],
          [14.5, 19.0, 16.5, 21.7],
        ],
      };
  }
}
