import { z } from "zod";

// Chart types supported
export const chartTypes = [
  "line",
  "scatter",
  "bar",
  "barH",
  "area",
  "pie",
  "radar",
  "heatmap",
  "boxplot",
  "violin",
] as const;

export type ChartType = (typeof chartTypes)[number];

export const chartTypeLabels: Record<ChartType, string> = {
  line: "折线图",
  scatter: "散点图",
  bar: "柱状图",
  barH: "条形图",
  area: "面积图",
  pie: "饼图",
  radar: "雷达图",
  heatmap: "热力图",
  boxplot: "箱线图",
  violin: "小提琴图",
};

// Nature-level color palette (muted, high-contrast, colorblind-safe)
export const NATURE_COLORS = [
  "#2E6B8A", // Steel Blue
  "#C75C2F", // Burnt Orange
  "#4A8C5C", // Sage Green
  "#8B5E8B", // Muted Purple
  "#D4A84B", // Muted Gold
  "#C74A60", // Muted Rose
  "#5B7E9E", // Dusty Blue
  "#7A6B3A", // Dark Khaki
];

export const chartConfigSchema = z.object({
  chartType: z.enum(chartTypes),
  title: z.string().default(""),
  xAxisLabel: z.string().default(""),
  yAxisLabel: z.string().default(""),
  showLegend: z.boolean().default(true),
  showGrid: z.boolean().default(true),
  smooth: z.boolean().default(false),
  showSymbol: z.boolean().default(true),
  symbolSize: z.number().default(6),
  lineWidth: z.number().default(2),
  fontSize: z.number().default(14),
  fontFamily: z.string().default("Inter, Helvetica Neue, Arial, sans-serif"),
  width: z.number().default(800),
  height: z.number().default(600),
  colors: z.array(z.string()).default(NATURE_COLORS),
  barWidth: z.string().default("60%"),
  heatmapMin: z.number().optional(),
  heatmapMax: z.number().optional(),
  backgroundColor: z.string().default("#ffffff"),
  showErrorBars: z.boolean().default(false),
  areaOpacity: z.number().default(0.35),
  pieRoseType: z.boolean().default(false),
  pieDonut: z.boolean().default(false),
});

export type ChartConfig = z.infer<typeof chartConfigSchema>;

export const defaultChartConfig: ChartConfig = {
  chartType: "line",
  title: "",
  xAxisLabel: "",
  yAxisLabel: "",
  showLegend: true,
  showGrid: true,
  smooth: false,
  showSymbol: true,
  symbolSize: 6,
  lineWidth: 2,
  fontSize: 14,
  fontFamily: "Inter, Helvetica Neue, Arial, sans-serif",
  width: 800,
  height: 600,
  colors: NATURE_COLORS,
  barWidth: "60%",
  backgroundColor: "#ffffff",
  showErrorBars: false,
  areaOpacity: 0.35,
  pieRoseType: false,
  pieDonut: false,
};
