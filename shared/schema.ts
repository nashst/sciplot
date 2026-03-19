import { z } from "zod";

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
  "histogram",
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
  histogram: "直方图",
  violin: "小提琴图",
};

export const NATURE_COLORS = [
  "#2E6B8A",
  "#C75C2F",
  "#4A8C5C",
  "#8B5E8B",
  "#D4A84B",
  "#C74A60",
  "#5B7E9E",
  "#7A6B3A",
];

export const colorThemes: Record<string, { label: string; colors: string[] }> = {
  nature: { label: "Nature", colors: NATURE_COLORS },
  science: {
    label: "Science",
    colors: ["#3C5488", "#E64B35", "#00A087", "#F39B7F", "#4DBBD5", "#91D1C2", "#8491B4", "#B09C85"],
  },
  cell: {
    label: "Cell",
    colors: ["#635547", "#C72228", "#45A4D5", "#EFC000", "#3F8C3F", "#8B5E8B", "#F39B7F", "#B09C85"],
  },
  lancet: {
    label: "Lancet",
    colors: ["#00468B", "#ED0000", "#42B540", "#0099B4", "#925E9F", "#FDAF91", "#AD002A", "#ADB6B6"],
  },
  nejm: {
    label: "NEJM",
    colors: ["#BC3C29", "#0072B5", "#E18727", "#20854E", "#7876B1", "#6F99AD", "#FFDC91", "#EE4C97"],
  },
  pastel: {
    label: "柔和",
    colors: ["#8DD3C7", "#FFFFB3", "#BEBADA", "#FB8072", "#80B1D3", "#FDB462", "#B3DE69", "#FCCDE5"],
  },
  vibrant: {
    label: "鲜艳",
    colors: ["#E41A1C", "#377EB8", "#4DAF4A", "#984EA3", "#FF7F00", "#A65628", "#F781BF", "#999999"],
  },
};

export const journalPresets: Record<string, { label: string; icon: string; description: string }> = {
  default: { label: "默认", icon: "??", description: "通用默认风格" },
  academic: { label: "学术", icon: "??", description: "经典黑白期刊风" },
  nature: { label: "Nature", icon: "??", description: "Nature 风格" },
  science: { label: "Science", icon: "??", description: "Science 风格" },
  cell: { label: "Cell", icon: "??", description: "Cell 风格" },
  clear: { label: "清爽", icon: "?", description: "简洁无干扰" },
};

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
  showDataLabels: z.boolean().default(false),
  stacked: z.boolean().default(false),
  sortData: z.enum(["none", "asc", "desc"]).default("none"),
  colorTheme: z.string().default("nature"),
  showDataZoom: z.boolean().default(false),
  referenceLine: z.number().optional(),
  referenceLineLabel: z.string().default(""),
  selectedColumns: z.array(z.number()).default([]),
  xAxisColumn: z.number().default(0),
  showTrendLine: z.boolean().default(false),
  showConfidenceInterval: z.boolean().default(false),
  errorBarType: z.enum(["none", "sd", "se"]).default("none"),
  aspectRatio: z.string().default("free"),
  stylePreset: z.string().default("default"),
  xAxisInterval: z.number().optional(),
  yAxisInterval: z.number().optional(),
  showSignificance: z.boolean().default(false),
});

export type ChartConfig = z.infer<typeof chartConfigSchema>;

export const insertUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const userSchema = insertUserSchema.extend({
  id: z.string(),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = z.infer<typeof userSchema>;

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
  showDataLabels: false,
  stacked: false,
  sortData: "none",
  colorTheme: "nature",
  showDataZoom: false,
  referenceLineLabel: "",
  selectedColumns: [],
  xAxisColumn: 0,
  showTrendLine: false,
  showConfidenceInterval: false,
  errorBarType: "none",
  aspectRatio: "free",
  stylePreset: "default",
  showSignificance: false,
};
