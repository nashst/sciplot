import { memo, useCallback, useMemo, useRef } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import {
  BarChart,
  BoxplotChart,
  CustomChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
} from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import { Button } from "@/components/ui/button";
import { buildChart, type ParsedData } from "@/lib/chartEngine";
import { chartTypeLabels, type ChartConfig, type ChartType } from "@shared/schema";
import { ArrowRight, Download, FileType, Image, Sparkles } from "lucide-react";

import type { EChartsOption } from "echarts";

echarts.use([
  LineChart,
  ScatterChart,
  BarChart,
  HeatmapChart,
  BoxplotChart,
  PieChart,
  RadarChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  VisualMapComponent,
  DataZoomComponent,
  RadarComponent,
  MarkLineComponent,
  CanvasRenderer,
  SVGRenderer,
]);

type RecommendationCard = {
  chartType: ChartType;
  title: string;
  reason: string;
  supported: boolean;
  patch: Pick<ChartConfig, "chartType" | "xAxisColumn" | "selectedColumns" | "xAxisLabel" | "yAxisLabel">;
};

interface ChartPreviewProps {
  data: ParsedData;
  config: ChartConfig;
  recommendations: RecommendationCard[];
  insight: string;
  onApplyRecommendation: (patch: RecommendationCard["patch"]) => void;
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function buildHistogramOption(data: ParsedData, config: ChartConfig): EChartsOption {
  const columnIndex = Math.min(config.xAxisColumn, Math.max(0, data.headers.length - 1));
  const values = data.rows
    .map((row) => parseNumeric(row[columnIndex]))
    .filter((value): value is number => value !== null);

  if (!values.length) {
    return {
      backgroundColor: config.backgroundColor,
      title: { text: "没有找到可用于直方图的数值列", left: "center", top: 24, textStyle: { fontFamily: config.fontFamily, fontSize: config.fontSize } },
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const binCount = Math.max(6, Math.min(16, Math.round(Math.sqrt(values.length)) || 6));
  const range = max - min || 1;
  const binWidth = range / binCount || 1;
  const bins = Array.from({ length: binCount }, () => 0);

  values.forEach((value) => {
    const rawIndex = Math.floor((value - min) / binWidth);
    const index = Math.max(0, Math.min(binCount - 1, rawIndex));
    bins[index] += 1;
  });

  const labels = bins.map((_, index) => {
    const left = min + binWidth * index;
    const right = index === binCount - 1 ? max : min + binWidth * (index + 1);
    const precision = Math.abs(binWidth) < 1 ? 2 : 1;
    return `${left.toFixed(precision)} - ${right.toFixed(precision)}`;
  });

  return {
    backgroundColor: config.backgroundColor,
    animation: false,
    grid: {
      top: 48,
      left: 56,
      right: 24,
      bottom: 52,
      containLabel: true,
    },
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
    },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { color: "#475569", fontFamily: config.fontFamily, fontSize: config.fontSize - 1, interval: 0, rotate: 22 },
      axisLine: { lineStyle: { color: "rgba(148, 163, 184, 0.45)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#475569", fontFamily: config.fontFamily, fontSize: config.fontSize - 1 },
      splitLine: { show: config.showGrid, lineStyle: { color: "rgba(148, 163, 184, 0.22)" } },
    },
    series: [
      {
        type: "bar",
        data: bins,
        barMaxWidth: 36,
        itemStyle: {
          color: config.colors[0],
          borderRadius: [8, 8, 0, 0],
        },
      },
    ],
  };
}

export const ChartPreview = memo(function ChartPreview({
  data,
  config,
  recommendations,
  insight,
  onApplyRecommendation,
}: ChartPreviewProps) {
  const chartRef = useRef<ReactEChartsCore>(null);

  const option = useMemo<EChartsOption>(() => {
    if (config.chartType === "histogram") {
      return buildHistogramOption(data, config);
    }
    return buildChart(config.chartType, data, config);
  }, [data, config]);

  const hasData = data.headers.length > 0 && data.rows.length > 0;
  const activeLabel = chartTypeLabels[config.chartType] ?? config.chartType;
  const compactLayout = recommendations.length <= 4;

  const containerStyle = useMemo(() => {
    if (config.aspectRatio === "free") {
      return { width: "100%", height: "100%" };
    }
    const [width, height] = config.aspectRatio.split(":").map(Number);
    return {
      width: "100%",
      height: "auto",
      aspectRatio: `${width}/${height}`,
      maxWidth: "100%",
    };
  }, [config.aspectRatio]);

  const exportSVG = useCallback(() => {
    const width = config.width || 1200;
    const height = config.height || 800;
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.left = "-9999px";
    container.style.width = `${width}px`;
    container.style.height = `${height}px`;
    document.body.appendChild(container);

    const instance = echarts.init(container, undefined, { renderer: "svg", width, height });
    instance.setOption({ ...option, animation: false, backgroundColor: config.backgroundColor });

    window.setTimeout(() => {
      const svg = container.querySelector("svg");
      if (svg) {
        if (!svg.getAttribute("xmlns")) {
          svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        }
        const svgData = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${config.title || "sciplot-chart"}.svg`;
        anchor.click();
        URL.revokeObjectURL(url);
      }
      instance.dispose();
      document.body.removeChild(container);
    }, 160);
  }, [config.backgroundColor, config.height, config.title, config.width, option]);

  const exportPNG = useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    const url = instance.getDataURL({
      type: "png",
      pixelRatio: 3,
      backgroundColor: config.backgroundColor,
    });

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${config.title || "sciplot-chart"}.png`;
    anchor.click();
  }, [config.backgroundColor, config.title]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[1.5rem] bg-white/92 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-slate-700" />
            中间图表区
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">{config.title || "自动生成的首图"}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{insight}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">当前图：{activeLabel}</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">{data.rows.length} 行</span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-medium text-slate-600">{data.headers.length} 列</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={exportSVG} disabled={!hasData} className="h-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            <FileType className="mr-1.5 h-4 w-4" />
            SVG
          </Button>
          <Button variant="outline" size="sm" onClick={exportPNG} disabled={!hasData} className="h-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            <Image className="mr-1.5 h-4 w-4" />
            PNG
          </Button>
          <Button variant="outline" size="sm" onClick={() => onApplyRecommendation({ chartType: config.chartType, xAxisColumn: config.xAxisColumn, selectedColumns: config.selectedColumns, xAxisLabel: config.xAxisLabel, yAxisLabel: config.yAxisLabel })} className="h-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
            保持当前
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {recommendations.map((item) => {
          const active = item.chartType === config.chartType;
          return (
            <button
              key={`${item.chartType}-${item.title}`}
              type="button"
              onClick={() => onApplyRecommendation(item.patch)}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-all ${
                active
                  ? "bg-slate-950 text-white ring-slate-950"
                  : item.supported
                    ? "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                    : "bg-slate-100 text-slate-400 ring-slate-200"
              }`}
            >
              {item.title}
              <ArrowRight className="h-3 w-3" />
            </button>
          );
        })}
      </div>

      <div className="mt-3 rounded-2xl bg-slate-50/80 p-3 ring-1 ring-slate-200/70">
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">当前解释</div>
        <p className="mt-1 text-sm leading-6 text-slate-600">{insight}</p>
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-[1.5rem] bg-white ring-1 ring-slate-200/70">
        {hasData ? (
          <div style={containerStyle} className={`flex h-full items-center justify-center p-3 ${compactLayout ? "md:p-2" : ""}`}>
            <ReactEChartsCore
              ref={chartRef}
              echarts={echarts}
              option={option}
              style={{ width: "100%", height: "100%", minHeight: compactLayout ? 280 : 340 }}
              opts={{ renderer: "canvas" }}
              notMerge
              lazyUpdate
            />
          </div>
        ) : (
          <div className="flex h-full min-h-[280px] items-center justify-center px-8 text-center text-slate-500">
            <div>
              <Download className="mx-auto h-10 w-10 opacity-30" />
              <p className="mt-3 text-sm font-medium text-slate-900">请先导入数据</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">支持 CSV / XLSX / 粘贴数据。导入后会自动生成首图。</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
});
