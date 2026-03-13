import type { EChartsOption } from "echarts";
import type { ChartConfig, ChartType } from "@shared/schema";
import { NATURE_COLORS } from "@shared/schema";

export interface ParsedData {
  headers: string[];
  rows: (string | number)[][];
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
      bottom: config.xAxisLabel ? 60 : 44,
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
  const series = data.headers.slice(1).map((name, i) => ({
    name,
    type: "line" as const,
    data: data.rows.map((r) => (isNumeric(r[i + 1]) ? toNumber(r[i + 1]) : null)),
    smooth: config.smooth,
    showSymbol: config.showSymbol,
    symbolSize: config.symbolSize,
    lineStyle: { width: config.lineWidth },
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
    series,
  };
}

export function buildScatterChart(data: ParsedData, config: ChartConfig): EChartsOption {
  const base = getBaseOption(config);

  // For scatter, we expect x, y pairs per series
  // If 2 cols: one series; if 3+ cols: col 0=x, col1=y1, col2=y2...
  const series = data.headers.slice(1).map((name, i) => ({
    name,
    type: "scatter" as const,
    data: data.rows
      .filter((r) => isNumeric(r[0]) && isNumeric(r[i + 1]))
      .map((r) => [toNumber(r[0]), toNumber(r[i + 1])]),
    symbolSize: config.symbolSize + 2,
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
    series,
  };
}

export function buildBarChart(data: ParsedData, config: ChartConfig): EChartsOption {
  const base = getBaseOption(config);
  const xData = data.rows.map((r) => r[0]);
  const series = data.headers.slice(1).map((name, i) => ({
    name,
    type: "bar" as const,
    data: data.rows.map((r) => (isNumeric(r[i + 1]) ? toNumber(r[i + 1]) : 0)),
    barWidth: config.barWidth,
    itemStyle: { borderRadius: [3, 3, 0, 0] },
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
    series,
  };
}

export function buildBarHChart(data: ParsedData, config: ChartConfig): EChartsOption {
  const base = getBaseOption(config);
  const yData = data.rows.map((r) => r[0]);
  const series = data.headers.slice(1).map((name, i) => ({
    name,
    type: "bar" as const,
    data: data.rows.map((r) => (isNumeric(r[i + 1]) ? toNumber(r[i + 1]) : 0)),
    barWidth: config.barWidth,
    itemStyle: { borderRadius: [0, 3, 3, 0] },
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

export function buildChart(
  chartType: ChartType,
  data: ParsedData,
  config: ChartConfig,
): EChartsOption {
  switch (chartType) {
    case "line":
      return buildLineChart(data, config);
    case "scatter":
      return buildScatterChart(data, config);
    case "bar":
      return buildBarChart(data, config);
    case "barH":
      return buildBarHChart(data, config);
    case "heatmap":
      return buildHeatmapChart(data, config);
    case "boxplot":
      return buildBoxplotChart(data, config);
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
  }
}
